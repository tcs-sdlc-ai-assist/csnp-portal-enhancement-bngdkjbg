import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMember } from '../../contexts/MemberContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getActivePCPAssignment, getProviderById } from '../../services/providerService.js';
import {
  canChangePcp,
  getAttestationStatus,
  ATTESTATION_STATUSES,
  PCP_CHANGE_REASONS,
  submitPcpChangeRequest,
  getActivePcpChangeRequest,
  getPcpChangeRequests,
} from '../../services/pcpChangeService.js';
import DoctorFinderModal from '../../components/member/DoctorFinderModal.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import FormField from '../../components/common/FormField.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatDate } from '../../utils/helpers.js';

/**
 * Compact provider summary line.
 * @param {Object} props
 * @param {Object|null} props.provider - Provider record
 * @param {string} [props.fallback] - Text when no provider
 * @returns {React.ReactElement}
 */
function ProviderLine({ provider, fallback = 'Not assigned' }) {
  if (!provider) {
    return <p className="text-sm text-gray-500">{fallback}</p>;
  }
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">Dr. {provider.firstName} {provider.lastName}</p>
      <p className="text-xs text-gray-500">{provider.specialty || 'General'} · {provider.facilityName || 'No facility'}</p>
    </div>
  );
}

/**
 * Status badge for a PCP change request.
 * @param {Object} props
 * @param {string} props.status - Request status
 * @returns {React.ReactElement}
 */
function RequestStatusBadge({ status }) {
  const map = {
    submitted: { s: 'pending', label: 'In Progress' },
    completed: { s: 'active', label: 'Completed' },
    cancelled: { s: 'expired', label: 'Cancelled' },
  };
  const cfg = map[status] || { s: 'pending', label: status };
  return <StatusBadge status={cfg.s} label={cfg.label} size="sm" showDot bordered />;
}

/**
 * Member PCP change page (FR-002, FR-003, FR-004).
 * Enforces the VCC-attestation gate, shows the current PCP, walks the member
 * through reason capture and the Doctor & Hospital Finder, then confirms with
 * a turnaround time. A failed submission notifies the member by email.
 *
 * @returns {React.ReactElement}
 */
export default function MemberPcpPage() {
  const { member, loading, error } = useMember();
  const { user } = useAuth();

  const [step, setStep] = useState('idle'); // idle | reason | review | done
  const [reason, setReason] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [newProvider, setNewProvider] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const eligibility = useMemo(() => canChangePcp(member), [member]);
  const attestationStatus = useMemo(() => getAttestationStatus(member), [member]);

  // Resolve the current PCP from the active assignment, falling back to the member record.
  const currentProvider = useMemo(() => {
    if (!member) {
      return null;
    }
    try {
      const assignment = getActivePCPAssignment(member.id);
      const providerId = (assignment && assignment.providerId) || member.primaryProviderId;
      return providerId ? getProviderById(providerId) : null;
    } catch {
      return null;
    }
  }, [member]);

  const currentProviderId = currentProvider ? currentProvider.id : (member ? member.primaryProviderId : null);

  const pendingRequest = useMemo(() => (member ? getActivePcpChangeRequest(member.id) : null), [member, reloadToken]);
  const history = useMemo(() => (member ? getPcpChangeRequests(member.id) : []), [member, reloadToken]);

  // Reset the flow whenever we leave it.
  const resetFlow = useCallback(() => {
    setStep('idle');
    setReason('');
    setReasonText('');
    setReasonError(null);
    setNewProvider(null);
    setSubmitError(null);
    setConfirmation(null);
  }, []);

  const handleStart = useCallback(() => {
    resetFlow();
    setStep('reason');
  }, [resetFlow]);

  const handleOpenFinder = useCallback(() => {
    if (!reason) {
      setReasonError('Please select a reason for your change.');
      return;
    }
    if (reason === 'other' && reasonText.trim().length === 0) {
      setReasonError('Please describe your reason for the change.');
      return;
    }
    setReasonError(null);
    setFinderOpen(true);
  }, [reason, reasonText]);

  const handleProviderSelected = useCallback((provider) => {
    setNewProvider(provider);
    setFinderOpen(false);
    setStep('review');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!member) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPcpChangeRequest(
        {
          member,
          currentProviderId,
          newProvider,
          reason,
          reasonText,
        },
        { performedBy: user ? user.id : undefined }
      );
      if (result.success) {
        setConfirmation(result);
        setStep('done');
        setReloadToken((t) => t + 1);
      } else {
        setSubmitError({ message: result.error, emailNotified: !!result.emailNotified });
      }
    } catch (err) {
      console.error('MemberPcpPage: submit error:', err);
      setSubmitError({ message: 'An unexpected error occurred. Please try again.', emailNotified: false });
    } finally {
      setSubmitting(false);
    }
  }, [member, currentProviderId, newProvider, reason, reasonText, user]);

  const reasonOptions = useMemo(
    () => [{ value: '', label: 'Select a reason…' }, ...PCP_CHANGE_REASONS],
    []
  );

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" variant="primary" text="Loading your provider information..." />
      </div>
    );
  }

  if (error || !member) {
    return (
      <EmptyState
        title="Provider information unavailable"
        description={error || 'We could not find your member record. Please contact support.'}
        iconType="error"
        size="md"
      />
    );
  }

  const showFlow = eligibility.allowed && !pendingRequest;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">Change Primary Care Provider</h1>
        <p className="mt-1 text-sm text-gray-500">Review your current PCP and request a change to a new in-network provider.</p>
      </div>

      {/* Eligibility gate (FR-002) */}
      {!eligibility.allowed ? (
        <Alert variant="warning" title="PCP change not available" showIcon bordered>
          {eligibility.message}
        </Alert>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 flex-shrink-0" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-xs text-green-800">
            <span className="font-semibold">VCC attestation: {attestationStatus === ATTESTATION_STATUSES.COMPLETED ? 'Completed' : 'In Progress'}.</span>{' '}
            You are eligible to request a PCP change.
          </p>
        </div>
      )}

      {/* Current PCP */}
      <Card bordered flat={false}>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-csnp-primary">Current Primary Care Provider</p>
          <ProviderLine provider={currentProvider} />
        </div>
      </Card>

      {/* Pending request (prevents duplicate submissions) */}
      {pendingRequest && (
        <Card bordered flat={false}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">PCP Change In Progress</p>
              <RequestStatusBadge status={pendingRequest.status} />
            </div>
            <Alert variant="info" title="Your request is being processed" showIcon bordered size="sm">
              We received your request to change to <strong>Dr. {pendingRequest.newProviderName}</strong>. Estimated completion by{' '}
              <strong>{formatDate(pendingRequest.estimatedCompletionDate)}</strong> (about {pendingRequest.turnaroundDays} business days). You will be notified when it is complete.
            </Alert>
          </div>
        </Card>
      )}

      {/* Change flow */}
      {showFlow && (
        <Card bordered flat={false}>
          {/* Step: idle */}
          {step === 'idle' && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-csnp-primary">Request a Change</p>
                <p className="text-xs text-gray-500 mt-0.5">Tell us why, then choose a new provider from the Doctor &amp; Hospital Finder.</p>
              </div>
              <Button variant="primary" size="md" onClick={handleStart}>Request PCP Change</Button>
            </div>
          )}

          {/* Step: reason */}
          {step === 'reason' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Reason for Change</p>
              <FormField
                name="reason"
                label="Why do you want to change your PCP?"
                type="select"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setReasonError(null); }}
                options={reasonOptions}
                required
                error={reasonError && reason !== 'other' ? reasonError : (reason === '' ? reasonError : null)}
              />
              {reason === 'other' && (
                <FormField
                  name="reasonText"
                  label="Please describe"
                  type="textarea"
                  value={reasonText}
                  onChange={(e) => { setReasonText(e.target.value); setReasonError(null); }}
                  rows={3}
                  maxLength={500}
                  required
                  error={reasonError}
                  placeholder="Tell us more about your reason for changing providers…"
                />
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <Button variant="outline" size="md" onClick={resetFlow}>Cancel</Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleOpenFinder}
                  iconRight={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  }
                >
                  Find a New Provider
                </Button>
              </div>
            </div>
          )}

          {/* Step: review */}
          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Review Your Request</p>

              {submitError && (
                <Alert variant="error" title="Request could not be submitted" showIcon bordered size="sm">
                  {submitError.message}
                  {submitError.emailNotified && (
                    <span className="block mt-1 text-[11px]">A confirmation email about this issue has been sent to {member.email}.</span>
                  )}
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Current PCP</p>
                  <div className="mt-1"><ProviderLine provider={currentProvider} /></div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold">New PCP</p>
                  <div className="mt-1"><ProviderLine provider={newProvider} /></div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Reason</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {(PCP_CHANGE_REASONS.find((r) => r.value === reason) || {}).label || reason}
                  {reason === 'other' && reasonText ? `: ${reasonText}` : ''}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                <Button variant="ghost" size="md" onClick={() => { setStep('reason'); setSubmitError(null); }} disabled={submitting}>
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="md" onClick={() => setFinderOpen(true)} disabled={submitting}>Change Provider</Button>
                  <Button variant="primary" size="md" onClick={handleSubmit} loading={submitting} loadingText="Submitting…">
                    Submit Request
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: done (FR-004 confirmation + turnaround) */}
          {step === 'done' && confirmation && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-green-600 mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">Your PCP change request was submitted</p>
                <p className="text-sm text-gray-500 mt-1">
                  We&apos;re processing your change to <strong>Dr. {confirmation.request.newProviderName}</strong>.
                </p>
              </div>
              <div className="inline-flex flex-col items-center gap-1 px-4 py-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
                <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Estimated Turnaround</p>
                <p className="text-sm font-bold text-csnp-primary">About {confirmation.turnaroundDays} business days</p>
                <p className="text-xs text-csnp-blue-700">Expected by {formatDate(confirmation.estimatedCompletionDate)}</p>
              </div>
              <div>
                <Button variant="primary" size="md" onClick={resetFlow}>Done</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Request history */}
      {history.length > 0 && (
        <Card bordered flat={false}>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">Request History</p>
            <div className="divide-y divide-gray-100">
              {history.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">To Dr. {req.newProviderName}</p>
                    <p className="text-[11px] text-gray-500">
                      {req.reasonLabel} · Submitted {formatDate(req.submittedAt)}
                    </p>
                  </div>
                  <RequestStatusBadge status={req.status} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Doctor & Hospital Finder (simulated SSO) */}
      <DoctorFinderModal
        isOpen={finderOpen}
        onClose={() => setFinderOpen(false)}
        onSelect={handleProviderSelected}
        memberId={member.id}
        currentProviderId={currentProviderId}
      />
    </div>
  );
}
