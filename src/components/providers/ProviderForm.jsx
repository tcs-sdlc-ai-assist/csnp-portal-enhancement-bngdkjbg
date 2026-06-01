import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import FormField from '../common/FormField.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { addProvider, updateProvider, getProviderById } from '../../services/providerService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Condition category options for multi-select.
 * @type {{ value: string, label: string }[]}
 */
const CONDITION_CATEGORY_OPTIONS = Object.entries(CONDITION_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Specialty options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const SPECIALTY_OPTIONS = [
  { value: 'Cardiology', label: 'Cardiology' },
  { value: 'Endocrinology', label: 'Endocrinology' },
  { value: 'Nephrology', label: 'Nephrology' },
  { value: 'Neurology', label: 'Neurology' },
  { value: 'Oncology', label: 'Oncology' },
  { value: 'Pulmonology', label: 'Pulmonology' },
  { value: 'Rheumatology', label: 'Rheumatology' },
  { value: 'Psychiatry', label: 'Psychiatry' },
  { value: 'Internal Medicine', label: 'Internal Medicine' },
  { value: 'Family Medicine', label: 'Family Medicine' },
  { value: 'Geriatrics', label: 'Geriatrics' },
  { value: 'Gastroenterology', label: 'Gastroenterology' },
  { value: 'Hematology', label: 'Hematology' },
  { value: 'Infectious Disease', label: 'Infectious Disease' },
  { value: 'Palliative Care', label: 'Palliative Care' },
  { value: 'Physical Medicine', label: 'Physical Medicine' },
  { value: 'Primary Care', label: 'Primary Care' },
  { value: 'Surgery', label: 'Surgery' },
  { value: 'Urology', label: 'Urology' },
  { value: 'Other', label: 'Other' },
];

/**
 * Contract type options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const CONTRACT_TYPE_OPTIONS = [
  { value: 'In-Network', label: 'In-Network' },
  { value: 'Out-of-Network', label: 'Out-of-Network' },
];

/**
 * Reimbursement rate options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const REIMBURSEMENT_RATE_OPTIONS = [
  { value: 'Fee-for-Service', label: 'Fee-for-Service' },
  { value: 'Capitated', label: 'Capitated' },
  { value: 'Value-Based', label: 'Value-Based' },
  { value: 'Bundled Payment', label: 'Bundled Payment' },
];

/**
 * Contract status options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const CONTRACT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'terminated', label: 'Terminated' },
];

/**
 * US state options for the address state select.
 * @type {{ value: string, label: string }[]}
 */
const US_STATE_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

/**
 * Condition category chip component.
 *
 * @param {Object} props
 * @param {string} props.category - Condition category value
 * @param {string} props.label - Display label
 * @param {boolean} props.selected - Whether the category is selected
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the chip is disabled
 * @returns {React.ReactElement}
 */
function ConditionCategoryChip({ category, label, selected, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(category)}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
        selected
          ? 'bg-csnp-primary text-white border-csnp-primary'
          : 'bg-white text-gray-600 border-gray-200 hover:border-csnp-primary-light hover:text-csnp-primary'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={selected}
    >
      {selected && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </button>
  );
}

ConditionCategoryChip.propTypes = {
  category: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ConditionCategoryChip.defaultProps = {
  disabled: false,
};

/**
 * Provider add/edit form component.
 * Provides provider name, NPI, specialty, contract details (start/end dates, terms),
 * network type, contact information, and address. Validates NPI format and contract dates.
 *
 * @param {Object} props
 * @param {string} [props.providerId] - Existing provider ID for editing
 * @param {Function} [props.onSave] - Callback when the provider is saved: (result) => void
 * @param {Function} [props.onCancel] - Callback when cancel is clicked
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function ProviderForm({
  providerId,
  onSave,
  onCancel,
  showHeader = true,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Provider info state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [npi, setNPI] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptingNewPatients, setAcceptingNewPatients] = useState(true);

  // Address state
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Contract state
  const [contractId, setContractId] = useState('');
  const [contractType, setContractType] = useState('In-Network');
  const [contractStatus, setContractStatus] = useState('active');
  const [reimbursementRate, setReimbursementRate] = useState('Fee-for-Service');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [terminationDate, setTerminationDate] = useState('');

  // Condition categories state
  const [selectedConditions, setSelectedConditions] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  /**
   * Loads existing provider data for editing.
   */
  useEffect(() => {
    if (typeof providerId !== 'string' || providerId.trim().length === 0) {
      return;
    }

    setLoading(true);
    setIsEditMode(true);

    try {
      const existingProvider = getProviderById(providerId.trim());
      if (existingProvider) {
        setFirstName(existingProvider.firstName || '');
        setLastName(existingProvider.lastName || '');
        setNPI(existingProvider.npi || '');
        setSpecialty(existingProvider.specialty || '');
        setFacilityName(existingProvider.facilityName || '');
        setEmail(existingProvider.email || '');
        setPhone(existingProvider.phone || '');
        setAcceptingNewPatients(existingProvider.acceptingNewPatients !== undefined ? existingProvider.acceptingNewPatients : true);

        if (existingProvider.address && typeof existingProvider.address === 'object') {
          setStreet(existingProvider.address.street || '');
          setCity(existingProvider.address.city || '');
          setState(existingProvider.address.state || '');
          setZipCode(existingProvider.address.zipCode || '');
        }

        if (existingProvider.contract && typeof existingProvider.contract === 'object') {
          setContractId(existingProvider.contract.contractId || '');
          setContractType(existingProvider.contract.contractType || 'In-Network');
          setContractStatus(existingProvider.contract.status || 'active');
          setReimbursementRate(existingProvider.contract.reimbursementRate || 'Fee-for-Service');
          setEffectiveDate(existingProvider.contract.effectiveDate || '');
          setTerminationDate(existingProvider.contract.terminationDate || '');
        }

        if (Array.isArray(existingProvider.conditionCategories)) {
          setSelectedConditions([...existingProvider.conditionCategories]);
        }
      } else {
        setFormError('Provider not found.');
      }
    } catch (err) {
      console.error('ProviderForm: failed to load provider:', err);
      setFormError('Failed to load provider data.');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  /**
   * Handles toggling a condition category.
   * @param {string} category - The condition category to toggle
   */
  const handleToggleCondition = useCallback((category) => {
    setSelectedConditions((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      }
      return [...prev, category];
    });
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated.conditionCategories;
      return updated;
    });
  }, []);

  /**
   * Validates NPI format (10-digit number).
   * @param {string} value - The NPI value
   * @returns {{ valid: boolean, error: string|null }}
   */
  const validateNPIFormat = useCallback((value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { valid: false, error: 'NPI is required' };
    }

    const trimmed = value.trim();
    const npiRegex = /^\d{10}$/;
    if (!npiRegex.test(trimmed)) {
      return { valid: false, error: 'NPI must be a 10-digit number' };
    }

    return { valid: true, error: null };
  }, []);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (typeof firstName !== 'string' || firstName.trim().length === 0) {
      errors.firstName = 'First name is required';
    }

    if (typeof lastName !== 'string' || lastName.trim().length === 0) {
      errors.lastName = 'Last name is required';
    }

    const npiValidation = validateNPIFormat(npi);
    if (!npiValidation.valid) {
      errors.npi = npiValidation.error;
    }

    if (typeof specialty !== 'string' || specialty.trim().length === 0) {
      errors.specialty = 'Specialty is required';
    }

    if (typeof facilityName !== 'string' || facilityName.trim().length === 0) {
      errors.facilityName = 'Facility name is required';
    }

    if (typeof email === 'string' && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    if (typeof phone === 'string' && phone.trim().length > 0) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10 && !(digits.length === 11 && digits.charAt(0) === '1')) {
        errors.phone = 'Please enter a valid 10-digit phone number';
      }
    }

    if (typeof effectiveDate === 'string' && effectiveDate.trim().length > 0) {
      const effDate = new Date(effectiveDate.trim() + 'T00:00:00');
      if (isNaN(effDate.getTime())) {
        errors.effectiveDate = 'Please enter a valid effective date';
      }
    }

    if (typeof terminationDate === 'string' && terminationDate.trim().length > 0) {
      const termDate = new Date(terminationDate.trim() + 'T00:00:00');
      if (isNaN(termDate.getTime())) {
        errors.terminationDate = 'Please enter a valid termination date';
      }
    }

    if (effectiveDate && terminationDate) {
      try {
        const start = new Date(effectiveDate.trim() + 'T00:00:00');
        const end = new Date(terminationDate.trim() + 'T00:00:00');
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start.getTime() > end.getTime()) {
          errors.terminationDate = 'Termination date must be after effective date';
        }
      } catch {
        // Ignore date parsing errors
      }
    }

    if (typeof zipCode === 'string' && zipCode.trim().length > 0) {
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(zipCode.trim())) {
        errors.zipCode = 'ZIP code must be in format XXXXX or XXXXX-XXXX';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [firstName, lastName, npi, specialty, facilityName, email, phone, effectiveDate, terminationDate, zipCode, validateNPIFormat]);

  /**
   * Handles form submission.
   * @param {React.FormEvent} e - Form event
   */
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setSaving(true);
      setFormError(null);

      try {
        const performedBy = user ? user.id : 'system';

        const providerData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          npi: npi.trim(),
          specialty: specialty.trim(),
          facilityName: facilityName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          acceptingNewPatients,
          address: {
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            zipCode: zipCode.trim(),
          },
          contract: {
            contractId: contractId.trim(),
            contractType,
            status: contractStatus,
            reimbursementRate,
            effectiveDate: effectiveDate.trim(),
            terminationDate: terminationDate.trim(),
          },
          conditionCategories: selectedConditions,
        };

        let result;

        if (isEditMode && providerId) {
          result = updateProvider(providerId.trim(), providerData, { performedBy });
        } else {
          result = addProvider(providerData, { performedBy });
        }

        if (result.success) {
          addNotification(
            'success',
            isEditMode ? 'Provider Updated' : 'Provider Added',
            `Provider "${firstName.trim()} ${lastName.trim()}" has been ${isEditMode ? 'updated' : 'added to the network'} successfully.`
          );

          if (typeof onSave === 'function') {
            onSave(result);
          }
        } else {
          setFormError(result.error || 'An error occurred while saving the provider.');
          addNotification(
            'error',
            'Save Failed',
            result.error || 'An error occurred while saving the provider.'
          );
        }
      } catch (err) {
        console.error('ProviderForm: save error:', err);
        setFormError('An unexpected error occurred while saving the provider.');
        addNotification('error', 'Save Error', 'An unexpected error occurred.');
      } finally {
        setSaving(false);
      }
    },
    [
      validateForm,
      user,
      firstName,
      lastName,
      npi,
      specialty,
      facilityName,
      email,
      phone,
      acceptingNewPatients,
      street,
      city,
      state,
      zipCode,
      contractId,
      contractType,
      contractStatus,
      reimbursementRate,
      effectiveDate,
      terminationDate,
      selectedConditions,
      isEditMode,
      providerId,
      addNotification,
      onSave,
    ]
  );

  /**
   * Handles form reset.
   */
  const handleReset = useCallback(() => {
    setFirstName('');
    setLastName('');
    setNPI('');
    setSpecialty('');
    setFacilityName('');
    setEmail('');
    setPhone('');
    setAcceptingNewPatients(true);
    setStreet('');
    setCity('');
    setState('');
    setZipCode('');
    setContractId('');
    setContractType('In-Network');
    setContractStatus('active');
    setReimbursementRate('Fee-for-Service');
    setEffectiveDate('');
    setTerminationDate('');
    setSelectedConditions([]);
    setFormError(null);
    setFormErrors({});
  }, []);

  /**
   * Computed: whether the form can be submitted.
   * @type {boolean}
   */
  const canSubmit = useMemo(() => {
    return (
      typeof firstName === 'string' &&
      firstName.trim().length > 0 &&
      typeof lastName === 'string' &&
      lastName.trim().length > 0 &&
      typeof npi === 'string' &&
      npi.trim().length > 0 &&
      typeof specialty === 'string' &&
      specialty.trim().length > 0 &&
      typeof facilityName === 'string' &&
      facilityName.trim().length > 0 &&
      !saving
    );
  }, [firstName, lastName, npi, specialty, facilityName, saving]);

  /**
   * Computed: network status label.
   * @type {string}
   */
  const networkStatusLabel = useMemo(() => {
    return contractType === 'In-Network' ? 'In-Network' : 'Out-of-Network';
  }, [contractType]);

  const containerClassName = [className].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={containerClassName} {...rest}>
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading provider data..."
        />
      </div>
    );
  }

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                {isEditMode ? 'Edit Provider' : 'Add Provider'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {isEditMode
                  ? 'Update the provider information, contract details, and network configuration.'
                  : 'Add a new provider to the network with contact information, contract details, and condition specialties.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Error */}
      {formError && (
        <Alert
          variant="error"
          title="Error"
          dismissible={true}
          onDismiss={() => setFormError(null)}
          className="mb-4"
        >
          {formError}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Section 1: Provider Information */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">
              Provider Information
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="firstName"
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.firstName;
                    return updated;
                  });
                }}
                placeholder="Enter first name"
                required={true}
                disabled={saving}
                error={formErrors.firstName}
              />

              <FormField
                name="lastName"
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.lastName;
                    return updated;
                  });
                }}
                placeholder="Enter last name"
                required={true}
                disabled={saving}
                error={formErrors.lastName}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="npi"
                label="National Provider Identifier (NPI)"
                type="text"
                value={npi}
                onChange={(e) => {
                  setNPI(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.npi;
                    return updated;
                  });
                }}
                placeholder="10-digit NPI number"
                required={true}
                disabled={saving}
                error={formErrors.npi}
                helperText="Must be a valid 10-digit National Provider Identifier"
                maxLength={10}
              />

              <FormField
                name="specialty"
                label="Specialty"
                type="select"
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.specialty;
                    return updated;
                  });
                }}
                options={SPECIALTY_OPTIONS}
                required={true}
                disabled={saving}
                error={formErrors.specialty}
                placeholder="Select specialty..."
              />
            </div>

            <FormField
              name="facilityName"
              label="Facility / Practice Name"
              type="text"
              value={facilityName}
              onChange={(e) => {
                setFacilityName(e.target.value);
                setFormErrors((prev) => {
                  const updated = { ...prev };
                  delete updated.facilityName;
                  return updated;
                });
              }}
              placeholder="e.g., Springfield Diabetes & Endocrine Center"
              required={true}
              disabled={saving}
              error={formErrors.facilityName}
            />

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700">Accepting New Patients</p>
                <p className="text-[10px] text-gray-500">Toggle whether this provider is currently accepting new patient assignments</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={acceptingNewPatients}
                onClick={() => !saving && setAcceptingNewPatients((prev) => !prev)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                  acceptingNewPatients ? 'bg-csnp-primary' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    acceptingNewPatients ? 'translate-x-5' : 'translate-x-0'
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </Card>

        {/* Section 2: Contact Information */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">
              Contact Information
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.email;
                    return updated;
                  });
                }}
                placeholder="provider@example.com"
                disabled={saving}
                error={formErrors.email}
              />

              <FormField
                name="phone"
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.phone;
                    return updated;
                  });
                }}
                placeholder="(555) 123-4567"
                disabled={saving}
                error={formErrors.phone}
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Practice Address */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">
              Practice Address
            </p>

            <FormField
              name="street"
              label="Street Address"
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Medical Plaza"
              disabled={saving}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                name="city"
                label="City"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                disabled={saving}
              />

              <FormField
                name="state"
                label="State"
                type="select"
                value={state}
                onChange={(e) => setState(e.target.value)}
                options={US_STATE_OPTIONS}
                placeholder="Select state..."
                disabled={saving}
              />

              <FormField
                name="zipCode"
                label="ZIP Code"
                type="text"
                value={zipCode}
                onChange={(e) => {
                  setZipCode(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.zipCode;
                    return updated;
                  });
                }}
                placeholder="XXXXX"
                disabled={saving}
                error={formErrors.zipCode}
              />
            </div>
          </div>
        </Card>

        {/* Section 4: Contract Details */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">
              Contract Details
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="contractId"
                label="Contract ID"
                type="text"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                placeholder="e.g., CTR-2024-001"
                disabled={saving}
                helperText="Unique contract identifier"
              />

              <FormField
                name="contractType"
                label="Network Type"
                type="select"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                options={CONTRACT_TYPE_OPTIONS}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="contractStatus"
                label="Contract Status"
                type="select"
                value={contractStatus}
                onChange={(e) => setContractStatus(e.target.value)}
                options={CONTRACT_STATUS_OPTIONS}
                disabled={saving}
              />

              <FormField
                name="reimbursementRate"
                label="Reimbursement Model"
                type="select"
                value={reimbursementRate}
                onChange={(e) => setReimbursementRate(e.target.value)}
                options={REIMBURSEMENT_RATE_OPTIONS}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="effectiveDate"
                label="Contract Effective Date"
                type="date"
                value={effectiveDate}
                onChange={(e) => {
                  setEffectiveDate(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.effectiveDate;
                    delete updated.terminationDate;
                    return updated;
                  });
                }}
                disabled={saving}
                error={formErrors.effectiveDate}
                helperText="Date the contract takes effect"
              />

              <FormField
                name="terminationDate"
                label="Contract Termination Date"
                type="date"
                value={terminationDate}
                onChange={(e) => {
                  setTerminationDate(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.terminationDate;
                    return updated;
                  });
                }}
                disabled={saving}
                error={formErrors.terminationDate}
                helperText="Date the contract expires"
              />
            </div>
          </div>
        </Card>

        {/* Section 5: Condition Categories */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">
                Condition Categories
              </p>
              {selectedConditions.length > 0 && (
                <span className="text-[10px] font-medium text-csnp-primary bg-csnp-blue-50 px-2 py-0.5 rounded-full">
                  {selectedConditions.length} selected
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Select the chronic condition categories this provider specializes in.
              This determines which C-SNP members can be assigned to this provider.
            </p>

            {formErrors.conditionCategories && (
              <p className="text-xs text-csnp-alert-error" role="alert">
                {formErrors.conditionCategories}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {CONDITION_CATEGORY_OPTIONS.map((option) => (
                <ConditionCategoryChip
                  key={option.value}
                  category={option.value}
                  label={option.label}
                  selected={selectedConditions.includes(option.value)}
                  onToggle={handleToggleCondition}
                  disabled={saving}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* CMS Compliance Notice */}
        <div className="mb-6">
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-csnp-primary flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">CMS Compliance:</span>{' '}
              All providers must have a valid 10-digit National Provider Identifier (NPI) and an active
              contract to participate in the C-SNP provider network. Provider networks must meet CMS
              network adequacy requirements (42 CFR §422.116). Ensure contract dates are current and
              condition categories align with the plan&apos;s eligible chronic conditions.
            </p>
          </div>
        </div>

        {/* Summary */}
        <Card bordered={true} flat={false} className="mb-6" variant="primary">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">
              Provider Summary
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Provider</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                  {firstName.trim() || lastName.trim()
                    ? `${firstName.trim()} ${lastName.trim()}`.trim()
                    : '—'}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">NPI</p>
                <p className="text-xs font-mono font-medium text-gray-700 mt-0.5">
                  {npi.trim() || '—'}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Network</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {networkStatusLabel}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Conditions</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {selectedConditions.length} selected
                </p>
              </div>
            </div>

            {selectedConditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedConditions.map((category) => (
                  <StatusBadge
                    key={category}
                    status="eligible"
                    label={CONDITION_CATEGORY_LABELS[category] || category}
                    size="sm"
                    showDot={false}
                    bordered={true}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              loadingText="Saving..."
              disabled={!canSubmit}
              iconLeft={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              {isEditMode ? 'Update Provider' : 'Add Provider'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReset}
              disabled={saving}
            >
              Reset
            </Button>

            {typeof onCancel === 'function' && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{specialty || 'No specialty'}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{networkStatusLabel}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{selectedConditions.length} condition{selectedConditions.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{acceptingNewPatients ? 'Accepting' : 'Not accepting'}</span>
          </div>
        </div>
      </form>
    </div>
  );
}

ProviderForm.propTypes = {
  providerId: PropTypes.string,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  showHeader: PropTypes.bool,
  className: PropTypes.string,
};

ProviderForm.defaultProps = {
  providerId: undefined,
  onSave: undefined,
  onCancel: undefined,
  showHeader: true,
  className: '',
};