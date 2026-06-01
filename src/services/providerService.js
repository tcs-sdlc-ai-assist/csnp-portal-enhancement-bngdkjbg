/**
 * Provider network management service for the CSNP Portal.
 * Provides provider network CRUD, PCP assignment, referral management,
 * network restriction enforcement, out-of-network handling, and audit logging.
 * @module providerService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray, removeFromArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import {
  AUDIT_ACTIONS,
  REFERRAL_STATUSES,
} from '../utils/constants.js';
import { validateRequired, validateNPI } from '../utils/validators.js';
import { CONDITION_CATEGORIES, CONDITION_CATEGORY_LABELS } from '../data/icd10Data.js';

/**
 * localStorage key for providers collection.
 * @type {string}
 */
const PROVIDERS_KEY = 'csnp_providers';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for referrals collection.
 * @type {string}
 */
const REFERRALS_KEY = 'csnp_referrals';

/**
 * localStorage key for provider assignments collection.
 * @type {string}
 */
const PROVIDER_ASSIGNMENTS_KEY = 'csnp_provider_assignments';

/**
 * @typedef {Object} ProviderAssignmentResult
 * @property {boolean} success - Whether the assignment succeeded
 * @property {string|null} assignmentId - The created assignment ID
 * @property {string|null} memberId - The member ID
 * @property {string|null} providerId - The provider ID
 * @property {boolean} networkRestriction - Whether network restriction was applied
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if assignment failed
 */

/**
 * @typedef {Object} ReferralResult
 * @property {boolean} success - Whether the referral operation succeeded
 * @property {string|null} referralId - The referral ID
 * @property {string} status - The referral status
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if operation failed
 */

/**
 * @typedef {Object} ProviderResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string|null} providerId - The provider ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if operation failed
 */

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retrieves all providers from localStorage.
 * @returns {Object[]} Array of provider objects
 */
function getAllProviders() {
  const providers = getItem(PROVIDERS_KEY, []);
  if (!Array.isArray(providers)) {
    return [];
  }
  return providers;
}

/**
 * Retrieves a member by ID from localStorage.
 * @param {string} memberId - The member ID
 * @returns {Object|null} The member object or null
 */
function getMemberByIdInternal(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }
  return findInArray(MEMBERS_KEY, (m) => m.id === memberId.trim());
}

/**
 * Retrieves a provider by ID from localStorage.
 * @param {string} providerId - The provider ID
 * @returns {Object|null} The provider object or null
 */
function getProviderByIdInternal(providerId) {
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return null;
  }
  return findInArray(PROVIDERS_KEY, (p) => p.id === providerId.trim());
}

/**
 * Retrieves all provider assignments from localStorage.
 * @returns {Object[]} Array of provider assignment objects
 */
function getAllProviderAssignments() {
  const assignments = getItem(PROVIDER_ASSIGNMENTS_KEY, []);
  if (!Array.isArray(assignments)) {
    return [];
  }
  return assignments;
}

/**
 * Retrieves all referrals from localStorage.
 * @returns {Object[]} Array of referral objects
 */
function getAllReferrals() {
  const referrals = getItem(REFERRALS_KEY, []);
  if (!Array.isArray(referrals)) {
    return [];
  }
  return referrals;
}

/**
 * Checks whether a provider is in-network based on their contract status.
 * @param {Object} provider - The provider object
 * @returns {boolean} Whether the provider is in-network
 */
function isProviderInNetwork(provider) {
  if (!provider || typeof provider !== 'object') {
    return false;
  }

  if (!provider.contract || typeof provider.contract !== 'object') {
    return false;
  }

  return provider.contract.status === 'active' && provider.contract.contractType === 'In-Network';
}

/**
 * Checks whether a provider supports a given condition category.
 * @param {Object} provider - The provider object
 * @param {string} conditionCategory - The condition category to check
 * @returns {boolean} Whether the provider supports the condition category
 */
function providerSupportsCondition(provider, conditionCategory) {
  if (!provider || typeof provider !== 'object') {
    return false;
  }

  if (!Array.isArray(provider.conditionCategories)) {
    return false;
  }

  if (typeof conditionCategory !== 'string' || conditionCategory.trim().length === 0) {
    return true;
  }

  return provider.conditionCategories.includes(conditionCategory.trim());
}

/**
 * Checks whether a provider is accepting new patients.
 * @param {Object} provider - The provider object
 * @returns {boolean} Whether the provider is accepting new patients
 */
function isAcceptingNewPatients(provider) {
  if (!provider || typeof provider !== 'object') {
    return false;
  }

  return provider.acceptingNewPatients === true;
}

/**
 * Checks whether a provider's contract is within its effective date range.
 * @param {Object} provider - The provider object
 * @returns {boolean} Whether the provider's contract is effective
 */
function isContractEffective(provider) {
  if (!provider || typeof provider !== 'object' || !provider.contract) {
    return false;
  }

  const contract = provider.contract;
  if (!contract.effectiveDate || !contract.terminationDate) {
    return contract.status === 'active';
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effective = new Date(contract.effectiveDate + 'T00:00:00');
    const termination = new Date(contract.terminationDate + 'T23:59:59');

    if (isNaN(effective.getTime()) || isNaN(termination.getTime())) {
      return contract.status === 'active';
    }

    return today.getTime() >= effective.getTime() && today.getTime() <= termination.getTime();
  } catch {
    return contract.status === 'active';
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Assigns a provider (PCP) to a member.
 * Validates that the provider is in-network, accepting new patients,
 * has an active contract, and supports the member's condition category.
 *
 * @param {string} memberId - The member ID
 * @param {string} providerId - The provider ID to assign
 * @param {Object} [options={}] - Assignment options
 * @param {string} [options.performedBy] - User ID performing the assignment
 * @param {boolean} [options.allowOutOfNetwork=false] - Allow out-of-network assignment
 * @returns {ProviderAssignmentResult} The provider assignment result
 */
export function assignProvider(memberId, providerId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const allowOutOfNetwork = options && options.allowOutOfNetwork === true;

  const defaultResult = {
    success: false,
    assignmentId: null,
    memberId: null,
    providerId: null,
    networkRestriction: false,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const providerIdResult = validateRequired(providerId, 'Provider ID');
  if (!providerIdResult.valid) {
    return { ...defaultResult, error: providerIdResult.error };
  }

  const trimmedMemberId = memberId.trim();
  const trimmedProviderId = providerId.trim();

  try {
    // Verify member exists
    const member = getMemberByIdInternal(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Verify provider exists
    const provider = getProviderByIdInternal(trimmedProviderId);
    if (!provider) {
      return { ...defaultResult, error: `Provider not found: ${trimmedProviderId}` };
    }

    // Check network status
    const inNetwork = isProviderInNetwork(provider);
    if (!inNetwork && !allowOutOfNetwork) {
      defaultResult.networkRestriction = true;

      logAction(
        AUDIT_ACTIONS.DENY,
        performedBy,
        {
          targetType: 'provider_assignment',
          targetId: '',
          description: `Provider assignment denied: Provider ${provider.firstName} ${provider.lastName} (${trimmedProviderId}) is not in-network for member ${member.firstName} ${member.lastName} (${trimmedMemberId})`,
          metadata: {
            memberId: trimmedMemberId,
            providerId: trimmedProviderId,
            reason: 'out_of_network',
            contractType: provider.contract ? provider.contract.contractType : 'unknown',
            contractStatus: provider.contract ? provider.contract.status : 'unknown',
          },
          ipAddress: '127.0.0.1',
        },
        'provider'
      );

      return {
        ...defaultResult,
        error: `Provider ${provider.firstName} ${provider.lastName} is not in-network. Out-of-network assignment requires explicit approval.`,
      };
    }

    // Check contract effectiveness
    if (!isContractEffective(provider)) {
      return {
        ...defaultResult,
        error: `Provider ${provider.firstName} ${provider.lastName} does not have an active contract within the effective date range.`,
      };
    }

    // Check if provider is accepting new patients
    if (!isAcceptingNewPatients(provider)) {
      return {
        ...defaultResult,
        error: `Provider ${provider.firstName} ${provider.lastName} is not currently accepting new patients.`,
      };
    }

    // Check condition category compatibility
    const memberCondition = member.conditionCategory || null;
    if (memberCondition && !providerSupportsCondition(provider, memberCondition)) {
      return {
        ...defaultResult,
        error: `Provider ${provider.firstName} ${provider.lastName} does not support condition category "${CONDITION_CATEGORY_LABELS[memberCondition] || memberCondition}".`,
      };
    }

    // Check for existing active assignment for this member
    const existingAssignments = getAllProviderAssignments();
    const existingActive = existingAssignments.find(
      (a) => a.memberId === trimmedMemberId && a.providerId === trimmedProviderId && a.status === 'active'
    );

    if (existingActive) {
      return {
        ...defaultResult,
        error: `Member already has an active PCP assignment with provider ${provider.firstName} ${provider.lastName} (${existingActive.id}).`,
      };
    }

    // Deactivate any existing active PCP assignment for this member
    const currentActive = existingAssignments.find(
      (a) => a.memberId === trimmedMemberId && a.status === 'active' && a.assignmentType === 'pcp'
    );

    if (currentActive) {
      updateInArray(
        PROVIDER_ASSIGNMENTS_KEY,
        (a) => a.id === currentActive.id,
        (a) => ({
          ...a,
          status: 'inactive',
          deactivatedAt: timestamp,
          deactivationReason: 'Replaced by new PCP assignment',
          updatedAt: timestamp,
        })
      );
    }

    // Create provider assignment record
    const assignmentId = uuidv4();
    const assignment = {
      id: assignmentId,
      memberId: trimmedMemberId,
      providerId: trimmedProviderId,
      assignmentType: 'pcp',
      status: 'active',
      inNetwork: inNetwork,
      conditionCategory: memberCondition,
      assignedBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist assignment
    const saved = appendToArray(PROVIDER_ASSIGNMENTS_KEY, assignment);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist provider assignment record' };
    }

    // Update member's primary provider ID
    updateInArray(
      MEMBERS_KEY,
      (m) => m.id === trimmedMemberId,
      (m) => ({
        ...m,
        primaryProviderId: trimmedProviderId,
        updatedAt: timestamp,
      })
    );

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.APPROVE,
      performedBy,
      {
        targetType: 'provider_assignment',
        targetId: assignmentId,
        description: `Provider ${provider.firstName} ${provider.lastName} (${provider.specialty}) assigned as PCP for member ${member.firstName} ${member.lastName} (${trimmedMemberId})${!inNetwork ? ' [OUT-OF-NETWORK]' : ''}`,
        metadata: {
          assignmentId,
          memberId: trimmedMemberId,
          providerId: trimmedProviderId,
          providerName: `${provider.firstName} ${provider.lastName}`,
          specialty: provider.specialty,
          inNetwork,
          conditionCategory: memberCondition,
          previousProviderId: currentActive ? currentActive.providerId : null,
        },
        ipAddress: '127.0.0.1',
      },
      'provider'
    );

    return {
      success: true,
      assignmentId,
      memberId: trimmedMemberId,
      providerId: trimmedProviderId,
      networkRestriction: !inNetwork,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('providerService.assignProvider: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during provider assignment' };
  }
}

/**
 * Retrieves the provider network with optional filtering.
 *
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.specialty] - Filter by specialty
 * @param {string} [filters.conditionCategory] - Filter by condition category
 * @param {boolean} [filters.acceptingNewPatients] - Filter by accepting new patients
 * @param {boolean} [filters.inNetworkOnly=false] - Only return in-network providers
 * @param {string} [filters.city] - Filter by city
 * @param {string} [filters.state] - Filter by state
 * @param {string} [filters.search] - Free-text search across name, specialty, facility
 * @returns {Object[]} Array of provider objects
 */
export function getProviderNetwork(filters = {}) {
  try {
    let providers = getAllProviders();

    if (!filters || typeof filters !== 'object') {
      return providers;
    }

    // Filter by specialty
    if (filters.specialty && typeof filters.specialty === 'string' && filters.specialty.trim().length > 0) {
      const specialtyFilter = filters.specialty.trim().toLowerCase();
      providers = providers.filter(
        (p) => p.specialty && p.specialty.toLowerCase().includes(specialtyFilter)
      );
    }

    // Filter by condition category
    if (filters.conditionCategory && typeof filters.conditionCategory === 'string' && filters.conditionCategory.trim().length > 0) {
      const categoryFilter = filters.conditionCategory.trim();
      providers = providers.filter(
        (p) => Array.isArray(p.conditionCategories) && p.conditionCategories.includes(categoryFilter)
      );
    }

    // Filter by accepting new patients
    if (filters.acceptingNewPatients === true) {
      providers = providers.filter((p) => p.acceptingNewPatients === true);
    } else if (filters.acceptingNewPatients === false) {
      providers = providers.filter((p) => p.acceptingNewPatients === false);
    }

    // Filter by in-network only
    if (filters.inNetworkOnly === true) {
      providers = providers.filter((p) => isProviderInNetwork(p));
    }

    // Filter by city
    if (filters.city && typeof filters.city === 'string' && filters.city.trim().length > 0) {
      const cityFilter = filters.city.trim().toLowerCase();
      providers = providers.filter(
        (p) => p.address && p.address.city && p.address.city.toLowerCase().includes(cityFilter)
      );
    }

    // Filter by state
    if (filters.state && typeof filters.state === 'string' && filters.state.trim().length > 0) {
      const stateFilter = filters.state.trim().toUpperCase();
      providers = providers.filter(
        (p) => p.address && p.address.state && p.address.state.toUpperCase() === stateFilter
      );
    }

    // Free-text search
    if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
      const searchQuery = filters.search.trim().toLowerCase();
      providers = providers.filter((p) => {
        const nameMatch = (p.firstName && p.firstName.toLowerCase().includes(searchQuery)) ||
          (p.lastName && p.lastName.toLowerCase().includes(searchQuery));
        const specialtyMatch = p.specialty && p.specialty.toLowerCase().includes(searchQuery);
        const facilityMatch = p.facilityName && p.facilityName.toLowerCase().includes(searchQuery);
        const npiMatch = p.npi && p.npi.includes(searchQuery);
        return nameMatch || specialtyMatch || facilityMatch || npiMatch;
      });
    }

    return providers;
  } catch (error) {
    console.error('providerService.getProviderNetwork: unexpected error:', error);
    return [];
  }
}

/**
 * Adds a new provider to the network.
 *
 * @param {Object} providerData - The provider data
 * @param {string} providerData.npi - National Provider Identifier
 * @param {string} providerData.firstName - First name
 * @param {string} providerData.lastName - Last name
 * @param {string} providerData.specialty - Medical specialty
 * @param {string} providerData.facilityName - Practice/facility name
 * @param {string} [providerData.email] - Email address
 * @param {string} [providerData.phone] - Phone number
 * @param {Object} [providerData.address] - Practice address
 * @param {Object} [providerData.contract] - Contract details
 * @param {boolean} [providerData.acceptingNewPatients=true] - Whether accepting new patients
 * @param {string[]} [providerData.conditionCategories] - Condition categories treated
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {ProviderResult} The provider creation result
 */
export function addProvider(providerData, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    providerId: null,
    auditId: null,
    timestamp,
  };

  if (!providerData || typeof providerData !== 'object') {
    return { ...defaultResult, error: 'Provider data is required' };
  }

  // Validate required fields
  const npiResult = validateRequired(providerData.npi, 'NPI');
  if (!npiResult.valid) {
    return { ...defaultResult, error: npiResult.error };
  }

  const npiFormatResult = validateNPI(providerData.npi, 'NPI');
  if (!npiFormatResult.valid) {
    return { ...defaultResult, error: npiFormatResult.error };
  }

  const firstNameResult = validateRequired(providerData.firstName, 'First name');
  if (!firstNameResult.valid) {
    return { ...defaultResult, error: firstNameResult.error };
  }

  const lastNameResult = validateRequired(providerData.lastName, 'Last name');
  if (!lastNameResult.valid) {
    return { ...defaultResult, error: lastNameResult.error };
  }

  const specialtyResult = validateRequired(providerData.specialty, 'Specialty');
  if (!specialtyResult.valid) {
    return { ...defaultResult, error: specialtyResult.error };
  }

  const facilityResult = validateRequired(providerData.facilityName, 'Facility name');
  if (!facilityResult.valid) {
    return { ...defaultResult, error: facilityResult.error };
  }

  try {
    // Check for duplicate NPI
    const existingProviders = getAllProviders();
    const duplicateNPI = existingProviders.find(
      (p) => p.npi === providerData.npi.trim()
    );

    if (duplicateNPI) {
      return {
        ...defaultResult,
        error: `A provider with NPI ${providerData.npi.trim()} already exists (${duplicateNPI.firstName} ${duplicateNPI.lastName}).`,
      };
    }

    // Create provider record
    const providerId = uuidv4();
    const provider = {
      id: providerId,
      npi: providerData.npi.trim(),
      firstName: providerData.firstName.trim(),
      lastName: providerData.lastName.trim(),
      specialty: providerData.specialty.trim(),
      facilityName: providerData.facilityName.trim(),
      email: (providerData.email && typeof providerData.email === 'string') ? providerData.email.trim() : '',
      phone: (providerData.phone && typeof providerData.phone === 'string') ? providerData.phone.trim() : '',
      address: (providerData.address && typeof providerData.address === 'object') ? { ...providerData.address } : {
        street: '',
        city: '',
        state: '',
        zipCode: '',
      },
      contract: (providerData.contract && typeof providerData.contract === 'object') ? { ...providerData.contract } : {
        contractId: '',
        effectiveDate: '',
        terminationDate: '',
        contractType: 'In-Network',
        reimbursementRate: 'Fee-for-Service',
        status: 'active',
      },
      acceptingNewPatients: providerData.acceptingNewPatients !== undefined ? providerData.acceptingNewPatients : true,
      conditionCategories: Array.isArray(providerData.conditionCategories) ? [...providerData.conditionCategories] : [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist provider
    const saved = appendToArray(PROVIDERS_KEY, provider);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist provider record' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'provider',
        targetId: providerId,
        description: `Provider ${provider.firstName} ${provider.lastName} (NPI: ${provider.npi}, ${provider.specialty}) added to network`,
        metadata: {
          providerId,
          npi: provider.npi,
          providerName: `${provider.firstName} ${provider.lastName}`,
          specialty: provider.specialty,
          facilityName: provider.facilityName,
          contractType: provider.contract.contractType,
          acceptingNewPatients: provider.acceptingNewPatients,
          conditionCategories: provider.conditionCategories,
        },
        ipAddress: '127.0.0.1',
      },
      'provider'
    );

    return {
      success: true,
      providerId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('providerService.addProvider: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred while adding provider' };
  }
}

/**
 * Updates an existing provider's information.
 *
 * @param {string} providerId - The provider ID to update
 * @param {Object} data - The data to update
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {ProviderResult} The provider update result
 */
export function updateProvider(providerId, data, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    providerId: null,
    auditId: null,
    timestamp,
  };

  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return { ...defaultResult, error: 'Provider ID is required' };
  }

  if (!data || typeof data !== 'object') {
    return { ...defaultResult, error: 'Update data is required' };
  }

  const trimmedId = providerId.trim();

  try {
    // Verify provider exists
    const existingProvider = getProviderByIdInternal(trimmedId);
    if (!existingProvider) {
      return { ...defaultResult, error: `Provider not found: ${trimmedId}` };
    }

    // If NPI is being updated, check for duplicates
    if (data.npi && typeof data.npi === 'string' && data.npi.trim() !== existingProvider.npi) {
      const npiFormatResult = validateNPI(data.npi, 'NPI');
      if (!npiFormatResult.valid) {
        return { ...defaultResult, error: npiFormatResult.error };
      }

      const existingProviders = getAllProviders();
      const duplicateNPI = existingProviders.find(
        (p) => p.npi === data.npi.trim() && p.id !== trimmedId
      );

      if (duplicateNPI) {
        return {
          ...defaultResult,
          error: `A provider with NPI ${data.npi.trim()} already exists (${duplicateNPI.firstName} ${duplicateNPI.lastName}).`,
        };
      }
    }

    // Build updated fields
    const updatedFields = [];

    const updated = updateInArray(
      PROVIDERS_KEY,
      (p) => p.id === trimmedId,
      (p) => {
        const updatedProvider = { ...p };

        if (data.npi && typeof data.npi === 'string') {
          updatedProvider.npi = data.npi.trim();
          updatedFields.push('npi');
        }
        if (data.firstName && typeof data.firstName === 'string') {
          updatedProvider.firstName = data.firstName.trim();
          updatedFields.push('firstName');
        }
        if (data.lastName && typeof data.lastName === 'string') {
          updatedProvider.lastName = data.lastName.trim();
          updatedFields.push('lastName');
        }
        if (data.specialty && typeof data.specialty === 'string') {
          updatedProvider.specialty = data.specialty.trim();
          updatedFields.push('specialty');
        }
        if (data.facilityName && typeof data.facilityName === 'string') {
          updatedProvider.facilityName = data.facilityName.trim();
          updatedFields.push('facilityName');
        }
        if (data.email !== undefined) {
          updatedProvider.email = typeof data.email === 'string' ? data.email.trim() : '';
          updatedFields.push('email');
        }
        if (data.phone !== undefined) {
          updatedProvider.phone = typeof data.phone === 'string' ? data.phone.trim() : '';
          updatedFields.push('phone');
        }
        if (data.address && typeof data.address === 'object') {
          updatedProvider.address = { ...p.address, ...data.address };
          updatedFields.push('address');
        }
        if (data.contract && typeof data.contract === 'object') {
          updatedProvider.contract = { ...p.contract, ...data.contract };
          updatedFields.push('contract');
        }
        if (data.acceptingNewPatients !== undefined) {
          updatedProvider.acceptingNewPatients = data.acceptingNewPatients;
          updatedFields.push('acceptingNewPatients');
        }
        if (Array.isArray(data.conditionCategories)) {
          updatedProvider.conditionCategories = [...data.conditionCategories];
          updatedFields.push('conditionCategories');
        }

        updatedProvider.updatedAt = timestamp;
        return updatedProvider;
      }
    );

    if (!updated) {
      return { ...defaultResult, providerId: trimmedId, error: 'Failed to update provider record' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'provider',
        targetId: trimmedId,
        description: `Provider ${existingProvider.firstName} ${existingProvider.lastName} (${trimmedId}) updated. Fields: ${updatedFields.join(', ')}`,
        metadata: {
          providerId: trimmedId,
          providerName: `${existingProvider.firstName} ${existingProvider.lastName}`,
          updatedFields,
        },
        ipAddress: '127.0.0.1',
      },
      'provider'
    );

    return {
      success: true,
      providerId: trimmedId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('providerService.updateProvider: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred while updating provider' };
  }
}

/**
 * Manages a referral (create, update status, or cancel).
 *
 * @param {Object} referralData - The referral data
 * @param {string} [referralData.id] - Existing referral ID (for updates)
 * @param {string} referralData.memberId - Member ID
 * @param {string} referralData.referringProviderId - Referring provider ID
 * @param {string} referralData.receivingProviderId - Receiving provider ID
 * @param {string} [referralData.status] - Referral status (for updates)
 * @param {string} referralData.reason - Reason for referral
 * @param {string} [referralData.urgency='routine'] - Urgency level
 * @param {string[]} [referralData.diagnosisCodes] - Related ICD-10 codes
 * @param {string} [referralData.referralDate] - Referral date (YYYY-MM-DD)
 * @param {string} [referralData.expirationDate] - Expiration date (YYYY-MM-DD)
 * @param {string} [referralData.notes] - Referral notes
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {ReferralResult} The referral operation result
 */
export function manageReferral(referralData, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    referralId: null,
    status: '',
    auditId: null,
    timestamp,
  };

  if (!referralData || typeof referralData !== 'object') {
    return { ...defaultResult, error: 'Referral data is required' };
  }

  const isUpdate = typeof referralData.id === 'string' && referralData.id.trim().length > 0;

  try {
    if (isUpdate) {
      // Update existing referral
      const trimmedId = referralData.id.trim();
      const existingReferral = findInArray(REFERRALS_KEY, (r) => r.id === trimmedId);

      if (!existingReferral) {
        return { ...defaultResult, error: `Referral not found: ${trimmedId}` };
      }

      // Validate status transition
      const newStatus = referralData.status || existingReferral.status;
      const validStatuses = Object.values(REFERRAL_STATUSES);
      if (!validStatuses.includes(newStatus)) {
        return { ...defaultResult, error: `Invalid referral status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}` };
      }

      const updated = updateInArray(
        REFERRALS_KEY,
        (r) => r.id === trimmedId,
        (r) => ({
          ...r,
          status: newStatus,
          notes: (referralData.notes && typeof referralData.notes === 'string')
            ? referralData.notes.trim()
            : r.notes,
          urgency: (referralData.urgency && typeof referralData.urgency === 'string')
            ? referralData.urgency.trim()
            : r.urgency,
          expirationDate: (referralData.expirationDate && typeof referralData.expirationDate === 'string')
            ? referralData.expirationDate.trim()
            : r.expirationDate,
          updatedAt: timestamp,
        })
      );

      if (!updated) {
        return { ...defaultResult, referralId: trimmedId, error: 'Failed to update referral record' };
      }

      // Audit log
      const auditEntry = logAction(
        AUDIT_ACTIONS.REFERRAL_UPDATE,
        performedBy,
        {
          targetType: 'referral',
          targetId: trimmedId,
          description: `Referral ${trimmedId} updated. Status: ${newStatus}. Member: ${existingReferral.memberId}`,
          metadata: {
            referralId: trimmedId,
            memberId: existingReferral.memberId,
            previousStatus: existingReferral.status,
            newStatus,
          },
          ipAddress: '127.0.0.1',
        },
        'provider'
      );

      return {
        success: true,
        referralId: trimmedId,
        status: newStatus,
        auditId: auditEntry ? auditEntry.id : null,
        timestamp,
      };
    } else {
      // Create new referral

      // Validate required fields
      const memberIdResult = validateRequired(referralData.memberId, 'Member ID');
      if (!memberIdResult.valid) {
        return { ...defaultResult, error: memberIdResult.error };
      }

      const referringResult = validateRequired(referralData.referringProviderId, 'Referring provider ID');
      if (!referringResult.valid) {
        return { ...defaultResult, error: referringResult.error };
      }

      const receivingResult = validateRequired(referralData.receivingProviderId, 'Receiving provider ID');
      if (!receivingResult.valid) {
        return { ...defaultResult, error: receivingResult.error };
      }

      const reasonResult = validateRequired(referralData.reason, 'Referral reason');
      if (!reasonResult.valid) {
        return { ...defaultResult, error: reasonResult.error };
      }

      const trimmedMemberId = referralData.memberId.trim();
      const trimmedReferringId = referralData.referringProviderId.trim();
      const trimmedReceivingId = referralData.receivingProviderId.trim();

      // Verify member exists
      const member = getMemberByIdInternal(trimmedMemberId);
      if (!member) {
        return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
      }

      // Verify referring provider exists
      const referringProvider = getProviderByIdInternal(trimmedReferringId);
      if (!referringProvider) {
        return { ...defaultResult, error: `Referring provider not found: ${trimmedReferringId}` };
      }

      // Verify receiving provider exists
      const receivingProvider = getProviderByIdInternal(trimmedReceivingId);
      if (!receivingProvider) {
        return { ...defaultResult, error: `Receiving provider not found: ${trimmedReceivingId}` };
      }

      // Cannot refer to self
      if (trimmedReferringId === trimmedReceivingId) {
        return { ...defaultResult, error: 'Referring and receiving providers cannot be the same' };
      }

      // Check for duplicate pending referral
      const existingReferrals = getAllReferrals();
      const duplicateReferral = existingReferrals.find(
        (r) =>
          r.memberId === trimmedMemberId &&
          r.referringProviderId === trimmedReferringId &&
          r.receivingProviderId === trimmedReceivingId &&
          (r.status === REFERRAL_STATUSES.PENDING || r.status === REFERRAL_STATUSES.ACCEPTED || r.status === REFERRAL_STATUSES.IN_PROGRESS)
      );

      if (duplicateReferral) {
        return {
          ...defaultResult,
          error: `An active referral already exists for this member to the same receiving provider (${duplicateReferral.id}).`,
        };
      }

      // Create referral record
      const referralId = uuidv4();
      const referralDate = (referralData.referralDate && typeof referralData.referralDate === 'string')
        ? referralData.referralDate.trim()
        : new Date().toISOString().split('T')[0];

      // Default expiration: 90 days from referral date
      let expirationDate = null;
      if (referralData.expirationDate && typeof referralData.expirationDate === 'string') {
        expirationDate = referralData.expirationDate.trim();
      } else {
        try {
          const expDate = new Date(referralDate + 'T00:00:00');
          expDate.setDate(expDate.getDate() + 90);
          const year = expDate.getFullYear();
          const month = String(expDate.getMonth() + 1).padStart(2, '0');
          const day = String(expDate.getDate()).padStart(2, '0');
          expirationDate = `${year}-${month}-${day}`;
        } catch {
          expirationDate = null;
        }
      }

      const referral = {
        id: referralId,
        memberId: trimmedMemberId,
        referringProviderId: trimmedReferringId,
        receivingProviderId: trimmedReceivingId,
        status: REFERRAL_STATUSES.PENDING,
        reason: referralData.reason.trim(),
        urgency: (referralData.urgency && typeof referralData.urgency === 'string')
          ? referralData.urgency.trim()
          : 'routine',
        diagnosisCodes: Array.isArray(referralData.diagnosisCodes)
          ? referralData.diagnosisCodes.map((c) => typeof c === 'string' ? c.trim().toUpperCase() : '')
          : [],
        referralDate,
        expirationDate,
        notes: (referralData.notes && typeof referralData.notes === 'string')
          ? referralData.notes.trim()
          : '',
        createdBy: performedBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Persist referral
      const saved = appendToArray(REFERRALS_KEY, referral);
      if (!saved) {
        return { ...defaultResult, error: 'Failed to persist referral record' };
      }

      // Audit log
      const auditEntry = logAction(
        AUDIT_ACTIONS.REFERRAL_CREATE,
        performedBy,
        {
          targetType: 'referral',
          targetId: referralId,
          description: `Referral created for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). From: ${referringProvider.firstName} ${referringProvider.lastName} (${referringProvider.specialty}). To: ${receivingProvider.firstName} ${receivingProvider.lastName} (${receivingProvider.specialty}). Urgency: ${referral.urgency}`,
          metadata: {
            referralId,
            memberId: trimmedMemberId,
            referringProviderId: trimmedReferringId,
            receivingProviderId: trimmedReceivingId,
            reason: referral.reason,
            urgency: referral.urgency,
            diagnosisCodes: referral.diagnosisCodes,
          },
          ipAddress: '127.0.0.1',
        },
        'provider'
      );

      return {
        success: true,
        referralId,
        status: REFERRAL_STATUSES.PENDING,
        auditId: auditEntry ? auditEntry.id : null,
        timestamp,
      };
    }
  } catch (error) {
    console.error('providerService.manageReferral: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during referral management' };
  }
}

/**
 * Retrieves a provider by ID with enriched data.
 *
 * @param {string} id - The provider ID
 * @returns {Object|null} The provider object with enriched data, or null
 */
export function getProviderById(id) {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }

  try {
    const provider = getProviderByIdInternal(id.trim());
    if (!provider) {
      return null;
    }

    // Enrich with assignment and referral counts
    const assignments = getAllProviderAssignments();
    const referrals = getAllReferrals();

    const activeAssignments = assignments.filter(
      (a) => a.providerId === id.trim() && a.status === 'active'
    );

    const activeReferralsReceiving = referrals.filter(
      (r) => r.receivingProviderId === id.trim() &&
        (r.status === REFERRAL_STATUSES.PENDING || r.status === REFERRAL_STATUSES.ACCEPTED || r.status === REFERRAL_STATUSES.IN_PROGRESS)
    );

    const activeReferralsReferring = referrals.filter(
      (r) => r.referringProviderId === id.trim() &&
        (r.status === REFERRAL_STATUSES.PENDING || r.status === REFERRAL_STATUSES.ACCEPTED || r.status === REFERRAL_STATUSES.IN_PROGRESS)
    );

    return {
      ...provider,
      inNetwork: isProviderInNetwork(provider),
      contractEffective: isContractEffective(provider),
      activePatientCount: activeAssignments.length,
      activeReferralsReceivingCount: activeReferralsReceiving.length,
      activeReferralsReferringCount: activeReferralsReferring.length,
      conditionCategoryLabels: Array.isArray(provider.conditionCategories)
        ? provider.conditionCategories.map((c) => ({
            category: c,
            label: CONDITION_CATEGORY_LABELS[c] || c,
          }))
        : [],
    };
  } catch (error) {
    console.error('providerService.getProviderById: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves provider assignments for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by assignment status
 * @param {string} [filters.assignmentType] - Filter by assignment type
 * @returns {Object[]} Array of provider assignment records
 */
export function getMemberProviderAssignments(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let assignments = getAllProviderAssignments();
    assignments = assignments.filter((a) => a.memberId === memberId.trim());

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      assignments = assignments.filter((a) => a.status === filters.status.trim());
    }

    if (filters && typeof filters.assignmentType === 'string' && filters.assignmentType.trim().length > 0) {
      assignments = assignments.filter((a) => a.assignmentType === filters.assignmentType.trim());
    }

    return assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('providerService.getMemberProviderAssignments: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the active PCP assignment for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object|null} The active PCP assignment or null
 */
export function getActivePCPAssignment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  try {
    const assignments = getMemberProviderAssignments(memberId, { status: 'active', assignmentType: 'pcp' });
    return assignments.length > 0 ? assignments[0] : null;
  } catch (error) {
    console.error('providerService.getActivePCPAssignment: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves referrals for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by referral status
 * @param {string} [filters.urgency] - Filter by urgency
 * @returns {Object[]} Array of referral records
 */
export function getMemberReferrals(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let referrals = getAllReferrals();
    referrals = referrals.filter((r) => r.memberId === memberId.trim());

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      referrals = referrals.filter((r) => r.status === filters.status.trim());
    }

    if (filters && typeof filters.urgency === 'string' && filters.urgency.trim().length > 0) {
      referrals = referrals.filter((r) => r.urgency === filters.urgency.trim());
    }

    return referrals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('providerService.getMemberReferrals: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves a referral by ID.
 *
 * @param {string} referralId - The referral ID
 * @returns {Object|null} The referral record or null
 */
export function getReferralById(referralId) {
  if (typeof referralId !== 'string' || referralId.trim().length === 0) {
    return null;
  }

  try {
    return findInArray(REFERRALS_KEY, (r) => r.id === referralId.trim());
  } catch (error) {
    console.error('providerService.getReferralById: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves referrals for a provider (as referring or receiving).
 *
 * @param {string} providerId - The provider ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.role] - 'referring' or 'receiving'
 * @param {string} [filters.status] - Filter by referral status
 * @returns {Object[]} Array of referral records
 */
export function getProviderReferrals(providerId, filters = {}) {
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return [];
  }

  try {
    let referrals = getAllReferrals();
    const trimmedId = providerId.trim();
    const role = (filters && typeof filters.role === 'string') ? filters.role.trim() : null;

    if (role === 'referring') {
      referrals = referrals.filter((r) => r.referringProviderId === trimmedId);
    } else if (role === 'receiving') {
      referrals = referrals.filter((r) => r.receivingProviderId === trimmedId);
    } else {
      referrals = referrals.filter(
        (r) => r.referringProviderId === trimmedId || r.receivingProviderId === trimmedId
      );
    }

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      referrals = referrals.filter((r) => r.status === filters.status.trim());
    }

    return referrals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('providerService.getProviderReferrals: unexpected error:', error);
    return [];
  }
}

/**
 * Deactivates a provider assignment.
 *
 * @param {string} assignmentId - The provider assignment ID
 * @param {string} [reason=''] - Deactivation reason
 * @param {string} [performedBy] - User ID performing the deactivation
 * @returns {{ success: boolean, error?: string }}
 */
export function deactivateProviderAssignment(assignmentId, reason, performedBy) {
  if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
    return { success: false, error: 'Assignment ID is required' };
  }

  const trimmedId = assignmentId.trim();

  try {
    const assignment = findInArray(PROVIDER_ASSIGNMENTS_KEY, (a) => a.id === trimmedId);
    if (!assignment) {
      return { success: false, error: `Provider assignment not found: ${trimmedId}` };
    }

    if (assignment.status !== 'active') {
      return { success: false, error: `Provider assignment is not active. Current status: "${assignment.status}"` };
    }

    const timestamp = new Date().toISOString();
    const deactivationReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      PROVIDER_ASSIGNMENTS_KEY,
      (a) => a.id === trimmedId,
      (a) => ({
        ...a,
        status: 'inactive',
        deactivationReason: deactivationReason,
        deactivatedAt: timestamp,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, error: 'Failed to update provider assignment' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'provider_assignment',
        targetId: trimmedId,
        description: `Provider assignment ${trimmedId} deactivated for member ${assignment.memberId}. Reason: ${deactivationReason || 'Not specified'}`,
        metadata: {
          assignmentId: trimmedId,
          memberId: assignment.memberId,
          providerId: assignment.providerId,
          reason: deactivationReason,
        },
        ipAddress: '127.0.0.1',
      },
      'provider'
    );

    return { success: true };
  } catch (error) {
    console.error('providerService.deactivateProviderAssignment: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred during deactivation' };
  }
}

/**
 * Checks whether a provider is eligible for a member based on network,
 * contract, accepting status, and condition category.
 *
 * @param {string} providerId - The provider ID
 * @param {string} memberId - The member ID
 * @returns {{ eligible: boolean, reasons: string[] }}
 */
export function checkProviderEligibility(providerId, memberId) {
  const result = { eligible: true, reasons: [] };

  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return { eligible: false, reasons: ['Provider ID is required'] };
  }

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return { eligible: false, reasons: ['Member ID is required'] };
  }

  try {
    const provider = getProviderByIdInternal(providerId.trim());
    if (!provider) {
      return { eligible: false, reasons: ['Provider not found'] };
    }

    const member = getMemberByIdInternal(memberId.trim());
    if (!member) {
      return { eligible: false, reasons: ['Member not found'] };
    }

    // Check network status
    if (!isProviderInNetwork(provider)) {
      result.eligible = false;
      result.reasons.push('Provider is not in-network');
    }

    // Check contract effectiveness
    if (!isContractEffective(provider)) {
      result.eligible = false;
      result.reasons.push('Provider contract is not within effective date range');
    }

    // Check accepting new patients
    if (!isAcceptingNewPatients(provider)) {
      result.eligible = false;
      result.reasons.push('Provider is not accepting new patients');
    }

    // Check condition category compatibility
    const memberCondition = member.conditionCategory || null;
    if (memberCondition && !providerSupportsCondition(provider, memberCondition)) {
      result.eligible = false;
      result.reasons.push(`Provider does not support condition category: ${CONDITION_CATEGORY_LABELS[memberCondition] || memberCondition}`);
    }

    return result;
  } catch (error) {
    console.error('providerService.checkProviderEligibility: unexpected error:', error);
    return { eligible: false, reasons: ['An unexpected error occurred during eligibility check'] };
  }
}

/**
 * Returns provider network statistics.
 *
 * @returns {{ totalProviders: number, inNetworkCount: number, outOfNetworkCount: number, acceptingNewPatientsCount: number, bySpecialty: Object.<string, number>, byConditionCategory: Object.<string, number>, totalAssignments: number, activeAssignments: number, totalReferrals: number, pendingReferrals: number }}
 */
export function getProviderStats() {
  try {
    const providers = getAllProviders();
    const assignments = getAllProviderAssignments();
    const referrals = getAllReferrals();

    const stats = {
      totalProviders: providers.length,
      inNetworkCount: 0,
      outOfNetworkCount: 0,
      acceptingNewPatientsCount: 0,
      bySpecialty: {},
      byConditionCategory: {},
      totalAssignments: assignments.length,
      activeAssignments: 0,
      totalReferrals: referrals.length,
      pendingReferrals: 0,
    };

    for (const provider of providers) {
      if (isProviderInNetwork(provider)) {
        stats.inNetworkCount++;
      } else {
        stats.outOfNetworkCount++;
      }

      if (provider.acceptingNewPatients) {
        stats.acceptingNewPatientsCount++;
      }

      const specialty = provider.specialty || 'Unknown';
      if (!stats.bySpecialty[specialty]) {
        stats.bySpecialty[specialty] = 0;
      }
      stats.bySpecialty[specialty]++;

      if (Array.isArray(provider.conditionCategories)) {
        for (const category of provider.conditionCategories) {
          if (!stats.byConditionCategory[category]) {
            stats.byConditionCategory[category] = 0;
          }
          stats.byConditionCategory[category]++;
        }
      }
    }

    for (const assignment of assignments) {
      if (assignment.status === 'active') {
        stats.activeAssignments++;
      }
    }

    for (const referral of referrals) {
      if (referral.status === REFERRAL_STATUSES.PENDING) {
        stats.pendingReferrals++;
      }
    }

    return stats;
  } catch (error) {
    console.error('providerService.getProviderStats: unexpected error:', error);
    return {
      totalProviders: 0,
      inNetworkCount: 0,
      outOfNetworkCount: 0,
      acceptingNewPatientsCount: 0,
      bySpecialty: {},
      byConditionCategory: {},
      totalAssignments: 0,
      activeAssignments: 0,
      totalReferrals: 0,
      pendingReferrals: 0,
    };
  }
}

/**
 * Finds providers matching a member's condition category who are
 * in-network, accepting new patients, and have active contracts.
 *
 * @param {string} memberId - The member ID
 * @returns {Object[]} Array of eligible provider objects
 */
export function findEligibleProvidersForMember(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    const member = getMemberByIdInternal(memberId.trim());
    if (!member) {
      return [];
    }

    const conditionCategory = member.conditionCategory || null;

    const filters = {
      inNetworkOnly: true,
      acceptingNewPatients: true,
    };

    if (conditionCategory) {
      filters.conditionCategory = conditionCategory;
    }

    const providers = getProviderNetwork(filters);

    // Further filter by contract effectiveness
    return providers.filter((p) => isContractEffective(p));
  } catch (error) {
    console.error('providerService.findEligibleProvidersForMember: unexpected error:', error);
    return [];
  }
}

/**
 * Cancels a referral.
 *
 * @param {string} referralId - The referral ID to cancel
 * @param {string} [reason=''] - Cancellation reason
 * @param {string} [performedBy] - User ID performing the cancellation
 * @returns {{ success: boolean, error?: string }}
 */
export function cancelReferral(referralId, reason, performedBy) {
  if (typeof referralId !== 'string' || referralId.trim().length === 0) {
    return { success: false, error: 'Referral ID is required' };
  }

  const trimmedId = referralId.trim();

  try {
    const referral = findInArray(REFERRALS_KEY, (r) => r.id === trimmedId);
    if (!referral) {
      return { success: false, error: `Referral not found: ${trimmedId}` };
    }

    const cancellableStatuses = [REFERRAL_STATUSES.PENDING, REFERRAL_STATUSES.ACCEPTED, REFERRAL_STATUSES.IN_PROGRESS];
    if (!cancellableStatuses.includes(referral.status)) {
      return {
        success: false,
        error: `Referral cannot be cancelled in "${referral.status}" status. Must be in: ${cancellableStatuses.join(', ')}`,
      };
    }

    const timestamp = new Date().toISOString();
    const cancelReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      REFERRALS_KEY,
      (r) => r.id === trimmedId,
      (r) => ({
        ...r,
        status: REFERRAL_STATUSES.CANCELLED,
        notes: cancelReason
          ? `${r.notes} | Cancelled: ${cancelReason}`
          : r.notes,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, error: 'Failed to update referral record' };
    }

    logAction(
      AUDIT_ACTIONS.REFERRAL_UPDATE,
      performedBy || 'system',
      {
        targetType: 'referral',
        targetId: trimmedId,
        description: `Referral ${trimmedId} cancelled for member ${referral.memberId}. Reason: ${cancelReason || 'Not specified'}`,
        metadata: {
          referralId: trimmedId,
          memberId: referral.memberId,
          previousStatus: referral.status,
          newStatus: REFERRAL_STATUSES.CANCELLED,
          reason: cancelReason,
        },
        ipAddress: '127.0.0.1',
      },
      'provider'
    );

    return { success: true };
  } catch (error) {
    console.error('providerService.cancelReferral: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred during referral cancellation' };
  }
}

/**
 * Returns all providers from localStorage.
 *
 * @returns {Object[]} Array of all provider records
 */
export function getAllProviderRecords() {
  try {
    return getAllProviders();
  } catch (error) {
    console.error('providerService.getAllProviderRecords: unexpected error:', error);
    return [];
  }
}

/**
 * Returns all referral records from localStorage.
 *
 * @returns {Object[]} Array of all referral records
 */
export function getAllReferralRecords() {
  try {
    return getAllReferrals();
  } catch (error) {
    console.error('providerService.getAllReferralRecords: unexpected error:', error);
    return [];
  }
}

/**
 * Returns all provider assignment records from localStorage.
 *
 * @returns {Object[]} Array of all provider assignment records
 */
export function getAllProviderAssignmentRecords() {
  try {
    return getAllProviderAssignments();
  } catch (error) {
    console.error('providerService.getAllProviderAssignmentRecords: unexpected error:', error);
    return [];
  }
}