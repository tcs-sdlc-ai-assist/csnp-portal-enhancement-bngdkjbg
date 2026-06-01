import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import FormField from '../common/FormField.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { configureBenefits, getBenefits } from '../../services/benefitsService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate, formatCurrency } from '../../utils/helpers.js';
import {
  PLAN_TYPES,
  PLAN_TYPE_LABELS,
  MEDICARE_PARTS,
  MEDICARE_PART_LABELS,
} from '../../utils/constants.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Plan type options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const PLAN_TYPE_OPTIONS = Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Condition category options for multi-select.
 * @type {{ value: string, label: string }[]}
 */
const CONDITION_CATEGORY_OPTIONS = Object.entries(CONDITION_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Medicare part toggle options.
 * @type {{ value: string, label: string }[]}
 */
const MEDICARE_PART_OPTIONS = Object.entries(MEDICARE_PART_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Default copay fields for benefit configuration.
 * @type {{ key: string, label: string, defaultCopay: number, defaultCoinsurance: number }[]}
 */
const DEFAULT_COPAY_FIELDS = [
  { key: 'primaryCare', label: 'Primary Care Visit', defaultCopay: 0, defaultCoinsurance: 0 },
  { key: 'specialistVisit', label: 'Specialist Visit', defaultCopay: 20, defaultCoinsurance: 0 },
  { key: 'emergencyRoom', label: 'Emergency Room', defaultCopay: 90, defaultCoinsurance: 0 },
  { key: 'inpatientHospital', label: 'Inpatient Hospital', defaultCopay: 250, defaultCoinsurance: 0 },
  { key: 'prescriptionDrugTier1', label: 'Rx Tier 1 (Preferred Generic)', defaultCopay: 0, defaultCoinsurance: 0 },
  { key: 'prescriptionDrugTier2', label: 'Rx Tier 2 (Generic)', defaultCopay: 10, defaultCoinsurance: 0 },
  { key: 'prescriptionDrugTier3', label: 'Rx Tier 3 (Preferred Brand)', defaultCopay: 42, defaultCoinsurance: 0 },
  { key: 'homeHealth', label: 'Home Health Services', defaultCopay: 0, defaultCoinsurance: 0 },
  { key: 'telehealth', label: 'Telehealth Visits', defaultCopay: 0, defaultCoinsurance: 0 },
];

/**
 * Additional benefit options with default descriptions.
 * @type {{ key: string, label: string, description: string }[]}
 */
const ADDITIONAL_BENEFIT_OPTIONS = [
  { key: 'telehealth', label: 'Telehealth', description: '$0 copay telehealth visits' },
  { key: 'transportation', label: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments' },
  { key: 'meals', label: 'Meals', description: '14 meals delivered after hospital discharge' },
  { key: 'diabetesProgram', label: 'Diabetes Management Program', description: 'Diabetes supplies and nutrition counseling' },
  { key: 'cardiacRehab', label: 'Cardiac Rehabilitation', description: 'Cardiac rehab sessions with copay' },
  { key: 'pulmonaryRehab', label: 'Pulmonary Rehabilitation', description: 'Pulmonary rehab sessions with copay' },
  { key: 'mentalHealth', label: 'Mental Health Services', description: '$0 copay outpatient mental health visits' },
  { key: 'fitnessProgram', label: 'Fitness Program', description: 'SilverSneakers or equivalent fitness membership' },
  { key: 'adultDayCare', label: 'Adult Day Care', description: '$0 copay for adult day care services' },
  { key: 'caregiverSupport', label: 'Caregiver Support', description: 'Respite care and caregiver training programs' },
  { key: 'homeSafety', label: 'Home Safety', description: 'Home safety evaluation and modifications' },
  { key: 'nutritionCounseling', label: 'Nutrition Counseling', description: 'Nutrition counseling sessions' },
  { key: 'smokingCessation', label: 'Smoking Cessation', description: 'Smoking cessation counseling and medications' },
  { key: 'dialysis', label: 'Dialysis Services', description: '20% coinsurance for dialysis services' },
  { key: 'oxygenEquipment', label: 'Oxygen Equipment', description: '20% coinsurance for home oxygen equipment' },
  { key: 'chemotherapy', label: 'Chemotherapy', description: '20% coinsurance for chemotherapy services' },
  { key: 'palliativeCare', label: 'Palliative Care', description: 'Palliative care consultation and support' },
];

/**
 * Coverage rule template options.
 * @type {{ key: string, label: string, description: string }[]}
 */
const COVERAGE_RULE_OPTIONS = [
  { key: 'priorAuthRequired', label: 'Prior Authorization Required', description: 'Require prior authorization for high-cost services' },
  { key: 'inNetworkOnly', label: 'In-Network Only', description: 'Restrict coverage to in-network providers only' },
  { key: 'referralRequired', label: 'Referral Required', description: 'Require PCP referral for specialist visits' },
  { key: 'annualReverification', label: 'Annual Re-Verification', description: 'Require annual chronic condition re-verification' },
  { key: 'stepTherapy', label: 'Step Therapy', description: 'Require step therapy for certain medications' },
  { key: 'quantityLimits', label: 'Quantity Limits', description: 'Apply quantity limits on prescriptions' },
  { key: 'preventiveCareWaiver', label: 'Preventive Care Cost Waiver', description: 'Waive cost-sharing for preventive care services' },
  { key: 'emergencyOONWaiver', label: 'Emergency OON Waiver', description: 'Waive out-of-network penalties for emergency services' },
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
 * Medicare part toggle component.
 *
 * @param {Object} props
 * @param {string} props.partValue - Medicare part value
 * @param {string} props.label - Display label
 * @param {boolean} props.enabled - Whether the part is enabled
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the toggle is disabled
 * @returns {React.ReactElement}
 */
function MedicarePartToggle({ partValue, label, enabled, onToggle, disabled = false }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700">{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => !disabled && onToggle(partValue)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
          enabled ? 'bg-csnp-primary' : 'bg-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

MedicarePartToggle.propTypes = {
  partValue: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

MedicarePartToggle.defaultProps = {
  disabled: false,
};

/**
 * Copay amount row component.
 *
 * @param {Object} props
 * @param {string} props.serviceKey - Service key
 * @param {string} props.label - Service label
 * @param {number} props.copay - Copay amount
 * @param {number} props.coinsurance - Coinsurance percentage
 * @param {string} props.description - Benefit description
 * @param {Function} props.onCopayChange - Copay change handler
 * @param {Function} props.onCoinsuranceChange - Coinsurance change handler
 * @param {Function} props.onDescriptionChange - Description change handler
 * @param {boolean} [props.disabled=false] - Whether inputs are disabled
 * @returns {React.ReactElement}
 */
function CopayRow({ serviceKey, label, copay, coinsurance, description, onCopayChange, onCoinsuranceChange, onDescriptionChange, disabled = false }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-2 border-b border-gray-100 last:border-b-0">
      <div className="col-span-3">
        <p className="text-xs font-medium text-gray-700">{label}</p>
      </div>
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            value={copay}
            onChange={(e) => onCopayChange(serviceKey, parseFloat(e.target.value) || 0)}
            min="0"
            step="1"
            disabled={disabled}
            className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            aria-label={`Copay for ${label}`}
          />
        </div>
      </div>
      <div className="col-span-2">
        <div className="relative">
          <input
            type="number"
            value={coinsurance}
            onChange={(e) => onCoinsuranceChange(serviceKey, parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="1"
            disabled={disabled}
            className="w-full pl-2 pr-5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            aria-label={`Coinsurance for ${label}`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
        </div>
      </div>
      <div className="col-span-5">
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(serviceKey, e.target.value)}
          disabled={disabled}
          placeholder="Description..."
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          aria-label={`Description for ${label}`}
        />
      </div>
    </div>
  );
}

CopayRow.propTypes = {
  serviceKey: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  copay: PropTypes.number.isRequired,
  coinsurance: PropTypes.number.isRequired,
  description: PropTypes.string.isRequired,
  onCopayChange: PropTypes.func.isRequired,
  onCoinsuranceChange: PropTypes.func.isRequired,
  onDescriptionChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CopayRow.defaultProps = {
  disabled: false,
};

/**
 * Additional benefit checkbox component.
 *
 * @param {Object} props
 * @param {string} props.benefitKey - Benefit key
 * @param {string} props.label - Benefit label
 * @param {string} props.description - Benefit description
 * @param {boolean} props.checked - Whether the benefit is checked
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @returns {React.ReactElement}
 */
function AdditionalBenefitCheckbox({ benefitKey, label, description, checked, onToggle, disabled = false }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
        checked
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center h-5 pt-0.5">
        <input
          type="checkbox"
          id={`benefit-${benefitKey}`}
          checked={checked}
          onChange={() => onToggle(benefitKey)}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <label
        htmlFor={`benefit-${benefitKey}`}
        className={`min-w-0 flex-1 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>
      </label>
    </div>
  );
}

AdditionalBenefitCheckbox.propTypes = {
  benefitKey: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AdditionalBenefitCheckbox.defaultProps = {
  disabled: false,
};

/**
 * Coverage rule checkbox component.
 *
 * @param {Object} props
 * @param {string} props.ruleKey - Rule key
 * @param {string} props.label - Rule label
 * @param {string} props.description - Rule description
 * @param {boolean} props.enabled - Whether the rule is enabled
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @returns {React.ReactElement}
 */
function CoverageRuleCheckbox({ ruleKey, label, description, enabled, onToggle, disabled = false }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
        enabled
          ? 'bg-csnp-blue-50 border-csnp-blue-100'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center h-5 pt-0.5">
        <input
          type="checkbox"
          id={`rule-${ruleKey}`}
          checked={enabled}
          onChange={() => onToggle(ruleKey)}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <label
        htmlFor={`rule-${ruleKey}`}
        className={`min-w-0 flex-1 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>
      </label>
    </div>
  );
}

CoverageRuleCheckbox.propTypes = {
  ruleKey: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CoverageRuleCheckbox.defaultProps = {
  disabled: false,
};

/**
 * Benefit package configuration form component.
 * Provides condition selection, plan type (C-SNP/D-SNP/I-SNP), Medicare parts
 * (A/B/D) toggles, copay amounts, deductible amounts, additional benefits
 * checkboxes (telehealth, transportation, meals, disease programs), effective
 * date range, and coverage rules editor.
 *
 * @param {Object} props
 * @param {string} [props.packageId] - Existing benefit package ID for editing
 * @param {Function} [props.onSave] - Callback when the package is saved: (result) => void
 * @param {Function} [props.onCancel] - Callback when cancel is clicked
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function BenefitPackageForm({
  packageId,
  onSave,
  onCancel,
  showHeader = true,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState(PLAN_TYPES.C_SNP);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [terminationDate, setTerminationDate] = useState('');
  const [monthlyPremium, setMonthlyPremium] = useState(0);
  const [annualDeductible, setAnnualDeductible] = useState(0);
  const [maxOutOfPocket, setMaxOutOfPocket] = useState(3400);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [medicareParts, setMedicareParts] = useState([
    MEDICARE_PARTS.PART_A,
    MEDICARE_PARTS.PART_B,
    MEDICARE_PARTS.PART_C,
    MEDICARE_PARTS.PART_D,
  ]);
  const [benefits, setBenefits] = useState(() => {
    const initial = {};
    for (const field of DEFAULT_COPAY_FIELDS) {
      initial[field.key] = {
        copay: field.defaultCopay,
        coinsurance: field.defaultCoinsurance,
        description: '',
      };
    }
    return initial;
  });
  const [additionalBenefits, setAdditionalBenefits] = useState({});
  const [coverageRules, setCoverageRules] = useState({
    annualReverification: true,
    preventiveCareWaiver: true,
    emergencyOONWaiver: true,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  /**
   * Loads existing benefit package data for editing.
   */
  useEffect(() => {
    if (typeof packageId !== 'string' || packageId.trim().length === 0) {
      return;
    }

    setLoading(true);
    setIsEditMode(true);

    try {
      const existingPackage = getBenefits(packageId.trim());
      if (existingPackage) {
        setName(existingPackage.name || '');
        setDescription(existingPackage.description || '');
        setPlanType(existingPackage.planType || PLAN_TYPES.C_SNP);
        setEffectiveDate(existingPackage.effectiveDate || '');
        setTerminationDate(existingPackage.terminationDate || '');
        setMonthlyPremium(typeof existingPackage.monthlyPremium === 'number' ? existingPackage.monthlyPremium : 0);
        setAnnualDeductible(typeof existingPackage.annualDeductible === 'number' ? existingPackage.annualDeductible : 0);
        setMaxOutOfPocket(typeof existingPackage.maxOutOfPocket === 'number' ? existingPackage.maxOutOfPocket : 3400);
        setSelectedConditions(Array.isArray(existingPackage.eligibleConditionCategories) ? [...existingPackage.eligibleConditionCategories] : []);

        if (existingPackage.benefits && typeof existingPackage.benefits === 'object') {
          const loadedBenefits = {};
          for (const field of DEFAULT_COPAY_FIELDS) {
            const existing = existingPackage.benefits[field.key];
            if (existing && typeof existing === 'object') {
              loadedBenefits[field.key] = {
                copay: typeof existing.copay === 'number' ? existing.copay : field.defaultCopay,
                coinsurance: typeof existing.coinsurance === 'number' ? existing.coinsurance : field.defaultCoinsurance,
                description: typeof existing.description === 'string' ? existing.description : '',
              };
            } else {
              loadedBenefits[field.key] = {
                copay: field.defaultCopay,
                coinsurance: field.defaultCoinsurance,
                description: '',
              };
            }
          }
          setBenefits(loadedBenefits);
        }
      }
    } catch (err) {
      console.error('BenefitPackageForm: failed to load package:', err);
      setFormError('Failed to load benefit package data.');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

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
      delete updated.conditions;
      return updated;
    });
  }, []);

  /**
   * Handles toggling a Medicare part.
   * @param {string} part - The Medicare part to toggle
   */
  const handleToggleMedicarePart = useCallback((part) => {
    setMedicareParts((prev) => {
      if (prev.includes(part)) {
        return prev.filter((p) => p !== part);
      }
      return [...prev, part];
    });
  }, []);

  /**
   * Handles copay amount change.
   * @param {string} serviceKey - The service key
   * @param {number} value - The new copay value
   */
  const handleCopayChange = useCallback((serviceKey, value) => {
    setBenefits((prev) => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        copay: value,
      },
    }));
  }, []);

  /**
   * Handles coinsurance percentage change.
   * @param {string} serviceKey - The service key
   * @param {number} value - The new coinsurance value
   */
  const handleCoinsuranceChange = useCallback((serviceKey, value) => {
    setBenefits((prev) => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        coinsurance: Math.min(100, Math.max(0, value)),
      },
    }));
  }, []);

  /**
   * Handles benefit description change.
   * @param {string} serviceKey - The service key
   * @param {string} value - The new description
   */
  const handleDescriptionChange = useCallback((serviceKey, value) => {
    setBenefits((prev) => ({
      ...prev,
      [serviceKey]: {
        ...prev[serviceKey],
        description: value,
      },
    }));
  }, []);

  /**
   * Handles toggling an additional benefit.
   * @param {string} benefitKey - The benefit key to toggle
   */
  const handleToggleAdditionalBenefit = useCallback((benefitKey) => {
    setAdditionalBenefits((prev) => ({
      ...prev,
      [benefitKey]: !prev[benefitKey],
    }));
  }, []);

  /**
   * Handles toggling a coverage rule.
   * @param {string} ruleKey - The rule key to toggle
   */
  const handleToggleCoverageRule = useCallback((ruleKey) => {
    setCoverageRules((prev) => ({
      ...prev,
      [ruleKey]: !prev[ruleKey],
    }));
  }, []);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Package name is required';
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      errors.description = 'Description is required';
    }

    if (selectedConditions.length === 0) {
      errors.conditions = 'At least one condition category must be selected';
    }

    if (typeof effectiveDate !== 'string' || effectiveDate.trim().length === 0) {
      errors.effectiveDate = 'Effective date is required';
    }

    if (typeof terminationDate !== 'string' || terminationDate.trim().length === 0) {
      errors.terminationDate = 'Termination date is required';
    }

    if (effectiveDate && terminationDate) {
      const start = new Date(effectiveDate + 'T00:00:00');
      const end = new Date(terminationDate + 'T00:00:00');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start.getTime() > end.getTime()) {
        errors.terminationDate = 'Termination date must be after effective date';
      }
    }

    if (typeof monthlyPremium === 'number' && monthlyPremium < 0) {
      errors.monthlyPremium = 'Monthly premium cannot be negative';
    }

    if (typeof annualDeductible === 'number' && annualDeductible < 0) {
      errors.annualDeductible = 'Annual deductible cannot be negative';
    }

    if (typeof maxOutOfPocket === 'number' && maxOutOfPocket < 0) {
      errors.maxOutOfPocket = 'Maximum out-of-pocket cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, description, selectedConditions, effectiveDate, terminationDate, monthlyPremium, annualDeductible, maxOutOfPocket]);

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

        const benefitsObj = {};
        for (const [key, value] of Object.entries(benefits)) {
          benefitsObj[key] = {
            copay: typeof value.copay === 'number' ? value.copay : 0,
            coinsurance: typeof value.coinsurance === 'number' ? value.coinsurance : 0,
            description: typeof value.description === 'string' ? value.description : '',
          };
        }

        const packageData = {
          name: name.trim(),
          planType,
          description: description.trim(),
          effectiveDate: effectiveDate.trim(),
          terminationDate: terminationDate.trim(),
          benefits: benefitsObj,
          eligibleConditionCategories: selectedConditions,
          monthlyPremium: typeof monthlyPremium === 'number' ? monthlyPremium : 0,
          annualDeductible: typeof annualDeductible === 'number' ? annualDeductible : 0,
          maxOutOfPocket: typeof maxOutOfPocket === 'number' ? maxOutOfPocket : 0,
        };

        if (isEditMode && packageId) {
          packageData.id = packageId.trim();
        }

        const result = configureBenefits(packageData, { performedBy });

        if (result.success) {
          addNotification(
            'success',
            isEditMode ? 'Benefit Package Updated' : 'Benefit Package Created',
            `Benefit package "${name.trim()}" has been ${isEditMode ? 'updated' : 'created'} successfully.`
          );

          if (typeof onSave === 'function') {
            onSave(result);
          }
        } else {
          setFormError(result.error || 'An error occurred while saving the benefit package.');
          addNotification(
            'error',
            'Save Failed',
            result.error || 'An error occurred while saving the benefit package.'
          );
        }
      } catch (err) {
        console.error('BenefitPackageForm: save error:', err);
        setFormError('An unexpected error occurred while saving the benefit package.');
        addNotification('error', 'Save Error', 'An unexpected error occurred.');
      } finally {
        setSaving(false);
      }
    },
    [
      validateForm,
      user,
      benefits,
      name,
      planType,
      description,
      effectiveDate,
      terminationDate,
      selectedConditions,
      monthlyPremium,
      annualDeductible,
      maxOutOfPocket,
      isEditMode,
      packageId,
      addNotification,
      onSave,
    ]
  );

  /**
   * Handles form reset.
   */
  const handleReset = useCallback(() => {
    setName('');
    setDescription('');
    setPlanType(PLAN_TYPES.C_SNP);
    setEffectiveDate('');
    setTerminationDate('');
    setMonthlyPremium(0);
    setAnnualDeductible(0);
    setMaxOutOfPocket(3400);
    setSelectedConditions([]);
    setMedicareParts([
      MEDICARE_PARTS.PART_A,
      MEDICARE_PARTS.PART_B,
      MEDICARE_PARTS.PART_C,
      MEDICARE_PARTS.PART_D,
    ]);

    const resetBenefits = {};
    for (const field of DEFAULT_COPAY_FIELDS) {
      resetBenefits[field.key] = {
        copay: field.defaultCopay,
        coinsurance: field.defaultCoinsurance,
        description: '',
      };
    }
    setBenefits(resetBenefits);
    setAdditionalBenefits({});
    setCoverageRules({
      annualReverification: true,
      preventiveCareWaiver: true,
      emergencyOONWaiver: true,
    });
    setFormError(null);
    setFormErrors({});
  }, []);

  /**
   * Computed: selected additional benefits count.
   * @type {number}
   */
  const selectedAdditionalBenefitsCount = useMemo(() => {
    return Object.values(additionalBenefits).filter(Boolean).length;
  }, [additionalBenefits]);

  /**
   * Computed: selected coverage rules count.
   * @type {number}
   */
  const selectedCoverageRulesCount = useMemo(() => {
    return Object.values(coverageRules).filter(Boolean).length;
  }, [coverageRules]);

  /**
   * Computed: whether the form can be submitted.
   * @type {boolean}
   */
  const canSubmit = useMemo(() => {
    return (
      typeof name === 'string' &&
      name.trim().length > 0 &&
      typeof description === 'string' &&
      description.trim().length > 0 &&
      selectedConditions.length > 0 &&
      typeof effectiveDate === 'string' &&
      effectiveDate.trim().length > 0 &&
      typeof terminationDate === 'string' &&
      terminationDate.trim().length > 0 &&
      !saving
    );
  }, [name, description, selectedConditions, effectiveDate, terminationDate, saving]);

  const containerClassName = [className].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={containerClassName} {...rest}>
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading benefit package..."
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
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                {isEditMode ? 'Edit Benefit Package' : 'Create Benefit Package'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {isEditMode
                  ? 'Update the benefit package configuration, copay schedules, and coverage rules.'
                  : 'Configure a new benefit package with condition-specific coverage, copay schedules, and CMS-compliant rules.'}
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
        {/* Section 1: Basic Information */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">
              Package Information
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="packageName"
                label="Package Name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.name;
                    return updated;
                  });
                }}
                placeholder="e.g., CSNP Comprehensive Care Plan"
                required={true}
                disabled={saving}
                error={formErrors.name}
                helperText="A descriptive name for the benefit package"
              />

              <FormField
                name="planType"
                label="Plan Type"
                type="select"
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                options={PLAN_TYPE_OPTIONS}
                required={true}
                disabled={saving}
              />
            </div>

            <FormField
              name="packageDescription"
              label="Description"
              type="textarea"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormErrors((prev) => {
                  const updated = { ...prev };
                  delete updated.description;
                  return updated;
                });
              }}
              placeholder="Describe the benefit package coverage, target population, and key features..."
              required={true}
              disabled={saving}
              error={formErrors.description}
              rows={3}
              maxLength={500}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="effectiveDate"
                label="Effective Date"
                type="date"
                value={effectiveDate}
                onChange={(e) => {
                  setEffectiveDate(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.effectiveDate;
                    return updated;
                  });
                }}
                required={true}
                disabled={saving}
                error={formErrors.effectiveDate}
                helperText="Date the benefit package takes effect"
              />

              <FormField
                name="terminationDate"
                label="Termination Date"
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
                required={true}
                disabled={saving}
                error={formErrors.terminationDate}
                helperText="Date the benefit package expires"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Condition Categories */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">
                Eligible Condition Categories
              </p>
              {selectedConditions.length > 0 && (
                <span className="text-[10px] font-medium text-csnp-primary bg-csnp-blue-50 px-2 py-0.5 rounded-full">
                  {selectedConditions.length} selected
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Select the chronic condition categories that qualify for this benefit package.
              Members with these conditions will be eligible for enrollment.
            </p>

            {formErrors.conditions && (
              <p className="text-xs text-csnp-alert-error" role="alert">
                {formErrors.conditions}
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

        {/* Section 3: Medicare Parts */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary">
              Medicare Parts Coverage
            </p>

            <p className="text-xs text-gray-500">
              Toggle the Medicare parts included in this benefit package.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MEDICARE_PART_OPTIONS.map((option) => (
                <MedicarePartToggle
                  key={option.value}
                  partValue={option.value}
                  label={option.label}
                  enabled={medicareParts.includes(option.value)}
                  onToggle={handleToggleMedicarePart}
                  disabled={saving}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Section 4: Financial Details */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary">
              Financial Details
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                name="monthlyPremium"
                label="Monthly Premium ($)"
                type="number"
                value={monthlyPremium}
                onChange={(e) => {
                  setMonthlyPremium(parseFloat(e.target.value) || 0);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.monthlyPremium;
                    return updated;
                  });
                }}
                min="0"
                step="0.01"
                disabled={saving}
                error={formErrors.monthlyPremium}
                helperText="Monthly premium amount for the member"
              />

              <FormField
                name="annualDeductible"
                label="Annual Deductible ($)"
                type="number"
                value={annualDeductible}
                onChange={(e) => {
                  setAnnualDeductible(parseFloat(e.target.value) || 0);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.annualDeductible;
                    return updated;
                  });
                }}
                min="0"
                step="0.01"
                disabled={saving}
                error={formErrors.annualDeductible}
                helperText="Annual deductible before coverage begins"
              />

              <FormField
                name="maxOutOfPocket"
                label="Max Out-of-Pocket ($)"
                type="number"
                value={maxOutOfPocket}
                onChange={(e) => {
                  setMaxOutOfPocket(parseFloat(e.target.value) || 0);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.maxOutOfPocket;
                    return updated;
                  });
                }}
                min="0"
                step="0.01"
                disabled={saving}
                error={formErrors.maxOutOfPocket}
                helperText="Maximum annual out-of-pocket expense"
              />
            </div>
          </div>
        </Card>

        {/* Section 5: Copay Schedule */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary">
              Copay & Coinsurance Schedule
            </p>

            <p className="text-xs text-gray-500">
              Configure copay amounts and coinsurance percentages for each service type.
            </p>

            {/* Header Row */}
            <div className="grid grid-cols-12 gap-3 items-center pb-2 border-b border-gray-200">
              <div className="col-span-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Service</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Copay</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Coinsurance</p>
              </div>
              <div className="col-span-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Description</p>
              </div>
            </div>

            {/* Copay Rows */}
            {DEFAULT_COPAY_FIELDS.map((field) => {
              const benefitData = benefits[field.key] || {
                copay: field.defaultCopay,
                coinsurance: field.defaultCoinsurance,
                description: '',
              };

              return (
                <CopayRow
                  key={field.key}
                  serviceKey={field.key}
                  label={field.label}
                  copay={benefitData.copay}
                  coinsurance={benefitData.coinsurance}
                  description={benefitData.description}
                  onCopayChange={handleCopayChange}
                  onCoinsuranceChange={handleCoinsuranceChange}
                  onDescriptionChange={handleDescriptionChange}
                  disabled={saving}
                />
              );
            })}
          </div>
        </Card>

        {/* Section 6: Additional Benefits */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">
                Additional Benefits
              </p>
              {selectedAdditionalBenefitsCount > 0 && (
                <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {selectedAdditionalBenefitsCount} included
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Select supplemental benefits to include in this package. These benefits enhance
              the standard Medicare coverage for C-SNP members.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ADDITIONAL_BENEFIT_OPTIONS.map((option) => (
                <AdditionalBenefitCheckbox
                  key={option.key}
                  benefitKey={option.key}
                  label={option.label}
                  description={option.description}
                  checked={additionalBenefits[option.key] === true}
                  onToggle={handleToggleAdditionalBenefit}
                  disabled={saving}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Section 7: Coverage Rules */}
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">
                Coverage Rules
              </p>
              {selectedCoverageRulesCount > 0 && (
                <span className="text-[10px] font-medium text-csnp-primary bg-csnp-blue-50 px-2 py-0.5 rounded-full">
                  {selectedCoverageRulesCount} active
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Configure coverage rules and restrictions for this benefit package.
              These rules enforce CMS compliance and manage utilization.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COVERAGE_RULE_OPTIONS.map((option) => (
                <CoverageRuleCheckbox
                  key={option.key}
                  ruleKey={option.key}
                  label={option.label}
                  description={option.description}
                  enabled={coverageRules[option.key] === true}
                  onToggle={handleToggleCoverageRule}
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
              Benefit packages must comply with CMS regulations for Chronic Condition Special Needs Plans
              (42 CFR §422.4). All C-SNP benefit packages must include condition-specific supplemental
              benefits, care coordination services, and annual re-verification requirements. Ensure copay
              and coinsurance amounts meet CMS maximum out-of-pocket limits.
            </p>
          </div>
        </div>

        {/* Summary */}
        <Card bordered={true} flat={false} className="mb-6" variant="primary">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">
              Package Summary
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {PLAN_TYPE_LABELS[planType] || planType}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Conditions</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {selectedConditions.length} selected
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Premium</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {formatCurrency(monthlyPremium)}/mo
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Max OOP</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {formatCurrency(maxOutOfPocket)}
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
              {isEditMode ? 'Update Package' : 'Create Package'}
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
            <span>{medicareParts.length} Medicare part{medicareParts.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{selectedAdditionalBenefitsCount} additional benefit{selectedAdditionalBenefitsCount !== 1 ? 's' : ''}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{selectedCoverageRulesCount} rule{selectedCoverageRulesCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </form>
    </div>
  );
}

BenefitPackageForm.propTypes = {
  packageId: PropTypes.string,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  showHeader: PropTypes.bool,
  className: PropTypes.string,
};

BenefitPackageForm.defaultProps = {
  packageId: undefined,
  onSave: undefined,
  onCancel: undefined,
  showHeader: true,
  className: '',
};