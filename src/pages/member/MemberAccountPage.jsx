import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMember } from '../../contexts/MemberContext.jsx';
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { calculateAge, formatPhone, toTitleCase } from '../../utils/helpers.js';
import { validateRequired, validateEmail, validatePhone } from '../../utils/validators.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import FormField from '../../components/common/FormField.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

/**
 * Builds the editable form state from a member record.
 * @param {Object|null} member - The member record
 * @returns {Object} Form field values
 */
function formFromMember(member) {
  const address = (member && member.address) || {};
  return {
    firstName: member?.firstName || '',
    lastName: member?.lastName || '',
    email: member?.email || '',
    phone: member?.phone || '',
    street: address.street || '',
    city: address.city || '',
    state: address.state || '',
    zipCode: address.zipCode || '',
  };
}

/**
 * Validates the editable account form.
 * @param {Object} form - The form values
 * @returns {Object} Map of field name to error message (empty if valid)
 */
function validateForm(form) {
  const errors = {};
  const checks = [
    ['firstName', validateRequired(form.firstName, 'First name')],
    ['lastName', validateRequired(form.lastName, 'Last name')],
    ['email', validateEmail(form.email)],
    ['phone', validatePhone(form.phone)],
    ['street', validateRequired(form.street, 'Street address')],
    ['city', validateRequired(form.city, 'City')],
    ['state', validateRequired(form.state, 'State')],
    ['zipCode', validateRequired(form.zipCode, 'ZIP code')],
  ];
  for (const [field, result] of checks) {
    if (!result.valid) {
      errors[field] = result.error;
    }
  }
  return errors;
}

/**
 * A read-only labelled fact (for non-editable plan identifiers).
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Field value
 * @returns {React.ReactElement}
 */
function ReadOnlyItem({ label, value }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

/**
 * Member account page (FR-001).
 * Lets a member view their profile and edit their contact information.
 * Non-editable plan identifiers are shown read-only. Changes persist to
 * localStorage via the member context and reflect immediately.
 *
 * @returns {React.ReactElement}
 */
export default function MemberAccountPage() {
  const { member, loading, error, updateProfile } = useMember();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromMember(member));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Keep the form in sync with the member record when not actively editing.
  useEffect(() => {
    if (!editing) {
      setForm(formFromMember(member));
    }
  }, [member, editing]);

  const age = useMemo(() => (member ? calculateAge(member.dateOfBirth) : null), [member]);
  const condition = useMemo(() => {
    if (!member || !member.conditionCategory) {
      return '—';
    }
    return CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory);
  }, [member]);

  const handleChange = useCallback((field) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setSaved(false);
  }, []);

  const handleEdit = useCallback(() => {
    setForm(formFromMember(member));
    setFieldErrors({});
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }, [member]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setForm(formFromMember(member));
    setFieldErrors({});
    setSaveError(null);
  }, [member]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const patch = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          zipCode: form.zipCode.trim(),
        },
      };
      const result = await updateProfile(patch);
      if (result.success) {
        setEditing(false);
        setSaved(true);
      } else {
        setSaveError(result.error || 'We could not save your changes. Please try again.');
      }
    } catch (err) {
      console.error('MemberAccountPage: save error:', err);
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [form, updateProfile]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" variant="primary" text="Loading your account..." />
      </div>
    );
  }

  if (error || !member) {
    return (
      <EmptyState
        title="Account unavailable"
        description={error || 'We could not find your member record. Please contact support.'}
        iconType="error"
        size="md"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">My Account</h1>
          <p className="mt-1 text-sm text-gray-500">
            View your information and keep your contact details up to date.
          </p>
        </div>
        {!editing && (
          <Button
            variant="primary"
            size="md"
            onClick={handleEdit}
            iconLeft={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            }
          >
            Edit Information
          </Button>
        )}
      </div>

      {/* Success notice */}
      {saved && (
        <Alert variant="success" title="Changes saved" showIcon bordered size="sm" dismissible onDismiss={() => setSaved(false)}>
          Your account information has been updated.
        </Alert>
      )}

      {/* Save error */}
      {saveError && (
        <Alert variant="error" title="Save failed" showIcon bordered size="sm" dismissible onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* Contact information */}
      <Card bordered flat={false}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary">Contact Information</p>

            {editing ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    name="firstName"
                    label="First Name"
                    value={form.firstName}
                    onChange={handleChange('firstName')}
                    required
                    disabled={saving}
                    error={fieldErrors.firstName}
                  />
                  <FormField
                    name="lastName"
                    label="Last Name"
                    value={form.lastName}
                    onChange={handleChange('lastName')}
                    required
                    disabled={saving}
                    error={fieldErrors.lastName}
                  />
                  <FormField
                    name="email"
                    label="Email Address"
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    required
                    disabled={saving}
                    error={fieldErrors.email}
                    helperText="Used for paperless documents and notifications."
                  />
                  <FormField
                    name="phone"
                    label="Phone Number"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    required
                    disabled={saving}
                    error={fieldErrors.phone}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <p className="text-sm font-semibold text-csnp-primary pt-2">Mailing Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FormField
                      name="street"
                      label="Street Address"
                      value={form.street}
                      onChange={handleChange('street')}
                      required
                      disabled={saving}
                      error={fieldErrors.street}
                    />
                  </div>
                  <FormField
                    name="city"
                    label="City"
                    value={form.city}
                    onChange={handleChange('city')}
                    required
                    disabled={saving}
                    error={fieldErrors.city}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      name="state"
                      label="State"
                      value={form.state}
                      onChange={handleChange('state')}
                      required
                      disabled={saving}
                      error={fieldErrors.state}
                      maxLength={2}
                      placeholder="IL"
                    />
                    <FormField
                      name="zipCode"
                      label="ZIP Code"
                      value={form.zipCode}
                      onChange={handleChange('zipCode')}
                      required
                      disabled={saving}
                      error={fieldErrors.zipCode}
                      placeholder="62701"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                  <Button variant="outline" size="md" onClick={handleCancel} disabled={saving} type="button">
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit" loading={saving} loadingText="Saving...">
                    Save Changes
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ReadOnlyItem label="Full Name" value={`${member.firstName} ${member.lastName}`} />
                <ReadOnlyItem label="Email Address" value={member.email} />
                <ReadOnlyItem label="Phone" value={member.phone ? formatPhone(member.phone) : '—'} />
                <ReadOnlyItem
                  label="Mailing Address"
                  value={member.address ? `${member.address.street}, ${member.address.city}, ${member.address.state} ${member.address.zipCode}` : '—'}
                />
              </div>
            )}
          </div>
        </form>
      </Card>

      {/* Plan identifiers (read-only) */}
      <Card bordered flat={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-csnp-primary">Plan &amp; Identifiers</p>
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Read-only</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ReadOnlyItem label="Plan Type" value="C-SNP (Part C)" />
            <ReadOnlyItem label="Member / Medicare ID" value={member.medicareId} />
            <ReadOnlyItem label="SSN" value={member.ssn} />
            <ReadOnlyItem label="Date of Birth" value={age != null ? `${member.dateOfBirth} (age ${age})` : member.dateOfBirth} />
            <ReadOnlyItem label="Primary Condition" value={condition} />
            <ReadOnlyItem label="Gender" value={member.gender} />
          </div>
          <p className="text-[10px] text-gray-400">
            To change plan identifiers or your diagnosis on file, please contact Member Services.
          </p>
        </div>
      </Card>
    </div>
  );
}
