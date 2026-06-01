import React, { useState, useCallback, useMemo } from 'react';
import { useMember } from '../../contexts/MemberContext.jsx';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  getPaperlessPrefs,
  setPaperlessEnabled,
  changeDeliveryEmail,
  verifyDeliveryEmail,
  getMemberDocuments,
  buildDocumentContent,
} from '../../services/documentsService.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import FormField from '../../components/common/FormField.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatDate } from '../../utils/helpers.js';

/**
 * Document-type filter options.
 * @type {{ value: string, label: string }[]}
 */
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: DOCUMENT_TYPES.EOB, label: 'EOB' },
  { value: DOCUMENT_TYPES.STATEMENT, label: 'Statements' },
  { value: DOCUMENT_TYPES.BENEFIT, label: 'Benefit Docs' },
];

/**
 * Icon (SVG paths) for each document type.
 * @param {string} type - Document type
 * @returns {React.ReactElement}
 */
function DocTypeIcon({ type }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {type === DOCUMENT_TYPES.EOB && <><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>}
      {type === DOCUMENT_TYPES.STATEMENT && <><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>}
    </svg>
  );
}

/**
 * Member documents & paperless delivery page (FR-005, FR-006).
 * @returns {React.ReactElement}
 */
export default function MemberDocumentsPage() {
  const { member, loading, error } = useMember();

  const [prefs, setPrefs] = useState(() => getPaperlessPrefs(member));
  const [busy, setBusy] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  // Re-sync prefs when the member becomes available.
  const memberId = member ? member.id : null;
  React.useEffect(() => {
    if (member) {
      setPrefs(getPaperlessPrefs(member));
    }
  }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const documents = useMemo(() => (member ? getMemberDocuments(member) : []), [member]);
  const filteredDocs = useMemo(
    () => (typeFilter === 'all' ? documents : documents.filter((d) => d.type === typeFilter)),
    [documents, typeFilter]
  );

  const handleToggle = useCallback(async () => {
    if (!member) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await setPaperlessEnabled(member, !prefs.enabled);
      setPrefs(result.prefs);
      setNotice({ variant: 'success', text: result.prefs.enabled ? 'Paperless delivery is now on.' : 'Paperless delivery is now off.' });
    } finally {
      setBusy(false);
    }
  }, [member, prefs.enabled]);

  const handleStartEditEmail = useCallback(() => {
    setEmailInput(prefs.deliveryEmail || '');
    setEmailError(null);
    setEditingEmail(true);
  }, [prefs.deliveryEmail]);

  const handleSaveEmail = useCallback(async () => {
    if (!member) {
      return;
    }
    setBusy(true);
    setEmailError(null);
    try {
      const result = await changeDeliveryEmail(member, emailInput);
      if (result.success) {
        setPrefs(result.prefs);
        setEditingEmail(false);
        setNotice(
          result.prefs.verified
            ? { variant: 'success', text: 'Delivery email updated.' }
            : { variant: 'info', text: `A verification email was sent to ${result.prefs.deliveryEmail}.` }
        );
      } else {
        setEmailError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }, [member, emailInput]);

  const handleVerify = useCallback(async () => {
    if (!member) {
      return;
    }
    setBusy(true);
    try {
      const result = await verifyDeliveryEmail(member);
      setPrefs(result.prefs);
      setNotice({ variant: 'success', text: 'Your delivery email has been verified.' });
    } finally {
      setBusy(false);
    }
  }, [member]);

  const handleDownload = useCallback((doc) => {
    if (!member) {
      return;
    }
    const content = buildDocumentContent(doc, member);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [member]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" variant="primary" text="Loading your documents..." />
      </div>
    );
  }

  if (error || !member) {
    return (
      <EmptyState
        title="Documents unavailable"
        description={error || 'We could not find your member record. Please contact support.'}
        iconType="error"
        size="md"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">Go paperless and access your plan documents anytime.</p>
      </div>

      {notice && (
        <Alert variant={notice.variant} showIcon bordered size="sm" dismissible onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {/* Paperless settings (FR-005) */}
      <Card bordered flat={false}>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">Paperless Delivery</p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-xs font-medium text-gray-700">Receive documents electronically</p>
              <p className="text-[10px] text-gray-500">When on, EOBs, statements, and benefit documents are delivered to your verified email instead of by mail.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              onClick={handleToggle}
              disabled={busy}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${prefs.enabled ? 'bg-csnp-primary' : 'bg-gray-300'} ${busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${prefs.enabled ? 'translate-x-5' : 'translate-x-0'}`} aria-hidden="true" />
            </button>
          </div>

          {/* Delivery email */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Delivery Email</p>
                {!editingEmail ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{prefs.deliveryEmail || '—'}</p>
                    <StatusBadge
                      status={prefs.verified ? 'active' : 'pending'}
                      label={prefs.verified ? 'Verified' : 'Unverified'}
                      size="sm"
                      showDot
                      bordered
                    />
                  </div>
                ) : null}
              </div>
              {!editingEmail && (
                <Button variant="outline" size="sm" onClick={handleStartEditEmail} disabled={busy}>Change</Button>
              )}
            </div>

            {editingEmail && (
              <div className="mt-3 space-y-3">
                <FormField
                  name="deliveryEmail"
                  label="New delivery email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailError(null); }}
                  error={emailError}
                  disabled={busy}
                  helperText="A new email must be verified before documents are sent there."
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingEmail(false)} disabled={busy}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={handleSaveEmail} loading={busy} loadingText="Saving…">Save Email</Button>
                </div>
              </div>
            )}

            {/* Unverified prompt */}
            {!editingEmail && !prefs.verified && (
              <div className="mt-3">
                <Alert variant="warning" showIcon bordered size="sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>This email isn&apos;t verified yet. Documents won&apos;t be delivered until it is.</span>
                    <Button variant="primary" size="sm" onClick={handleVerify} loading={busy} loadingText="Verifying…">
                      Verify Now
                    </Button>
                  </div>
                </Alert>
              </div>
            )}
          </div>

          {prefs.enabled && prefs.verified && (
            <p className="text-[11px] text-green-700">
              Paperless is active. New documents will be delivered to <strong>{prefs.deliveryEmail}</strong>.
            </p>
          )}
        </div>
      </Card>

      {/* Document center (FR-006) */}
      <Card bordered flat={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-csnp-primary">Your Documents</p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 focus:outline-none ${typeFilter === f.value ? 'bg-white text-csnp-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <EmptyState title="No documents" description="There are no documents in this category yet." iconType="no-data" size="sm" />
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {filteredDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-csnp-blue-50 text-csnp-primary flex items-center justify-center">
                      <DocTypeIcon type={doc.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={doc.title}>{doc.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(doc.date)} · {doc.format} · {doc.sizeKb} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    iconLeft={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    }
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
