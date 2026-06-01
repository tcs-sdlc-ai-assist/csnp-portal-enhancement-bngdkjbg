import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMember } from '../../contexts/MemberContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  NOTIFICATION_CATEGORIES,
  CATEGORY_META,
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  getNotificationPrefs,
  saveNotificationPrefs,
  deliverNotification,
  getOutbox,
} from '../../services/notificationsService.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime, formatDateTime } from '../../utils/helpers.js';

const METHOD_ORDER = [DELIVERY_METHODS.NONE, DELIVERY_METHODS.TEXT, DELIVERY_METHODS.EMAIL, DELIVERY_METHODS.BOTH];

/**
 * Segmented control for selecting a delivery method.
 * @param {Object} props
 * @param {string} props.value - Current method
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled] - Whether disabled
 * @returns {React.ReactElement}
 */
function MethodSelector({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {METHOD_ORDER.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          disabled={disabled}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 focus:outline-none ${
            value === m ? 'bg-white text-csnp-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={value === m}
        >
          {DELIVERY_METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

/**
 * Member notification preferences, delivery, and sync page (FR-007/008/009).
 * @returns {React.ReactElement}
 */
export default function MemberNotificationsPage() {
  const { member, loading, error } = useMember();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState(() => getNotificationPrefs(member));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [testCategory, setTestCategory] = useState(NOTIFICATION_CATEGORIES.COVERAGE_INFO);
  const [testNotice, setTestNotice] = useState(null);
  const [sending, setSending] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const memberId = member ? member.id : null;
  useEffect(() => {
    if (member) {
      setPrefs(getNotificationPrefs(member));
      setDirty(false);
    }
  }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const outbox = useMemo(() => (memberId ? getOutbox(memberId) : []), [memberId, reloadToken]);

  const handleMethodChange = useCallback((category, method) => {
    setPrefs((prev) => ({ ...prev, [category]: method }));
    setDirty(true);
    setSaveResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!member) {
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await saveNotificationPrefs(member, prefs, { performedBy: user ? user.id : undefined });
      setDirty(false);
      const validated = result.sync.ncompass && result.sync.ncompass.data ? result.sync.ncompass.data.validated : false;
      setSaveResult({
        cdmOk: !!(result.sync.cdm && result.sync.cdm.success),
        ncompassOk: !!(result.sync.ncompass && result.sync.ncompass.success),
        validated,
        checks: result.sync.ncompass && result.sync.ncompass.data ? result.sync.ncompass.data.checks : [],
      });
    } finally {
      setSaving(false);
    }
  }, [member, prefs, user]);

  const handleSendTest = useCallback(async () => {
    if (!member) {
      return;
    }
    setSending(true);
    setTestNotice(null);
    try {
      const meta = CATEGORY_META.find((c) => c.key === testCategory);
      const result = await deliverNotification(member, testCategory, {
        subject: `Test: ${meta ? meta.label : 'Notification'}`,
        body: `This is a test ${meta ? meta.label : ''} notification sent based on your delivery preferences.`,
      });
      setReloadToken((t) => t + 1);
      if (result.delivered) {
        setTestNotice({ variant: 'success', text: `Test notification sent via ${result.channels.join(' & ')}.` });
      } else {
        setTestNotice({ variant: 'info', text: result.reason });
      }
    } finally {
      setSending(false);
    }
  }, [member, testCategory]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" variant="primary" text="Loading your notification settings..." />
      </div>
    );
  }

  if (error || !member) {
    return (
      <EmptyState
        title="Notifications unavailable"
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
        <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">Notification Preferences</h1>
        <p className="mt-1 text-sm text-gray-500">Choose how you&apos;d like to hear from us for each type of notification.</p>
      </div>

      {/* Save result + sync status (FR-009) */}
      {saveResult && (
        <Alert
          variant={saveResult.validated ? 'success' : 'warning'}
          title="Preferences saved"
          showIcon
          bordered
          size="sm"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={saveResult.cdmOk ? 'text-green-700' : 'text-red-700'}>
                {saveResult.cdmOk ? '✓' : '✗'} Synced to CDM
              </span>
              <span className="text-gray-300">·</span>
              <span className={saveResult.ncompassOk ? 'text-green-700' : 'text-red-700'}>
                {saveResult.ncompassOk ? '✓' : '✗'} NCompass validation {saveResult.validated ? 'passed' : 'found issues'}
              </span>
            </div>
            {!saveResult.validated && saveResult.checks && saveResult.checks.filter((c) => !c.valid).map((c) => (
              <p key={c.category} className="text-[11px] text-amber-700">• {c.detail}</p>
            ))}
          </div>
        </Alert>
      )}

      {/* Preferences (FR-007) */}
      <Card bordered flat={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-csnp-primary">Delivery by Category</p>
            <span className="text-[10px] text-gray-400">Text · Email · Both · Off</span>
          </div>

          <div className="divide-y divide-gray-100">
            {CATEGORY_META.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                  <p className="text-[11px] text-gray-500">{cat.description}</p>
                </div>
                <MethodSelector
                  value={prefs[cat.key]}
                  onChange={(m) => handleMethodChange(cat.key, m)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="primary" size="md" onClick={handleSave} loading={saving} loadingText="Saving & syncing…" disabled={!dirty && !!saveResult}>
              Save Preferences
            </Button>
          </div>
          <p className="text-[10px] text-gray-400">
            Saving syncs your preferences to Consumer Data Management (CDM) and validates them in NCompass.
          </p>
        </div>
      </Card>

      {/* Send a test notification (FR-008) */}
      <Card bordered flat={false}>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-csnp-primary">Send a Test Notification</p>
          <p className="text-[11px] text-gray-500">Send yourself a sample notification to see how delivery works for a category.</p>
          {testNotice && (
            <Alert variant={testNotice.variant} showIcon bordered size="sm" dismissible onDismiss={() => setTestNotice(null)}>
              {testNotice.text}
            </Alert>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value)}
              disabled={sending}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-csnp-primary-light"
              aria-label="Test notification category"
            >
              {CATEGORY_META.map((c) => (
                <option key={c.key} value={c.key}>{c.label} — {DELIVERY_METHOD_LABELS[prefs[c.key]]}</option>
              ))}
            </select>
            <Button variant="outline" size="md" onClick={handleSendTest} loading={sending} loadingText="Sending…">
              Send Test
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification history (outbox) */}
      <Card bordered flat={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-csnp-primary">Recent Notifications</p>
            {outbox.length > 0 && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{outbox.length}</span>
            )}
          </div>
          {outbox.length === 0 ? (
            <EmptyState title="No notifications yet" description="Notifications we send you will appear here." iconType="no-data" size="sm" />
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-96 overflow-y-auto">
              {outbox.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${n.channel === 'email' ? 'bg-csnp-blue-50 text-csnp-primary' : 'bg-purple-50 text-purple-600'}`}>
                      {n.channel === 'email' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 5L2 7" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={n.subject}>{n.subject || '(no subject)'}</p>
                      <p className="text-[11px] text-gray-500 truncate">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5" title={formatDateTime(n.sentAt)}>
                        {n.channel === 'email' ? 'Email' : 'Text'} to {n.to || 'unknown'} · {formatRelativeTime(n.sentAt)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={n.status === 'sent' ? 'active' : 'expired'}
                    label={n.status === 'sent' ? 'Sent' : 'Failed'}
                    size="sm"
                    showDot
                    bordered
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
