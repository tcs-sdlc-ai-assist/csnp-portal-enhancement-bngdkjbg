import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import EligibilityForm from '../components/eligibility/EligibilityForm.jsx';
import EligibilityResults from '../components/eligibility/EligibilityResults.jsx';
import EligibilityHistory from '../components/eligibility/EligibilityHistory.jsx';
import ReverificationPanel from '../components/eligibility/ReverificationPanel.jsx';

/**
 * Eligibility management page with tabbed interface.
 * Tab 1: Validate Eligibility (EligibilityForm + EligibilityResults)
 * Tab 2: Eligibility History (EligibilityHistory)
 * Tab 3: Annual Re-verification (ReverificationPanel)
 *
 * @returns {React.ReactElement}
 */
export default function EligibilityPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Validation state
  const [validationResult, setValidationResult] = useState(null);
  const [validatedMemberId, setValidatedMemberId] = useState('');
  const [validatedEffectiveDate, setValidatedEffectiveDate] = useState('');
  const [validatedRetroDate, setValidatedRetroDate] = useState('');

  // History member ID state
  const [historyMemberId, setHistoryMemberId] = useState('');

  /**
   * Handles validation completion from the EligibilityForm.
   * @param {Object} result - The eligibility validation result
   */
  const handleValidationComplete = useCallback((result) => {
    setValidationResult(result);
  }, []);

  /**
   * Handles enrollment initiation from the EligibilityResults.
   * @param {Object} result - The eligibility result
   */
  const handleInitiateEnrollment = useCallback((result) => {
    addNotification(
      'info',
      'Enrollment Initiation',
      `Enrollment initiation would navigate to the enrollment form for member "${validatedMemberId}" with priority condition: ${result.priorityCondition || 'N/A'}.`
    );
  }, [validatedMemberId, addNotification]);

  /**
   * Handles revalidation from the EligibilityResults.
   */
  const handleRevalidate = useCallback(() => {
    setValidationResult(null);
  }, []);

  /**
   * Handles dismissing the EligibilityResults.
   */
  const handleDismissResults = useCallback(() => {
    setValidationResult(null);
  }, []);

  /**
   * Renders the Validate Eligibility tab content.
   * @returns {React.ReactElement}
   */
  function renderValidateTab() {
    return (
      <div className="space-y-6">
        {/* Eligibility Form */}
        <EligibilityForm
          initialMemberId={validatedMemberId}
          initialCodes={[]}
          onValidationComplete={(result) => {
            handleValidationComplete(result);
          }}
          showHeader={false}
        />

        {/* Eligibility Results */}
        {validationResult && (
          <div className="mt-6">
            <EligibilityResults
              result={validationResult}
              memberId={validatedMemberId}
              effectiveDate={validatedEffectiveDate}
              retroDate={validatedRetroDate}
              onInitiateEnrollment={handleInitiateEnrollment}
              onRevalidate={handleRevalidate}
              onDismiss={handleDismissResults}
              showEnrollmentAction={isAuthenticated}
              showRevalidateAction={true}
              showTimestamp={true}
              showAuditId={false}
              compact={false}
            />
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Eligibility History tab content.
   * @returns {React.ReactElement}
   */
  function renderHistoryTab() {
    return (
      <div className="space-y-4">
        {/* Member ID Input for History */}
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label htmlFor="history-member-id" className="font-medium text-sm text-gray-700 mb-1 block">
              Member ID
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="history-member-id"
                type="text"
                value={historyMemberId}
                onChange={(e) => setHistoryMemberId(e.target.value)}
                placeholder="Enter member ID to view history"
                className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200"
                aria-label="Member ID for eligibility history"
              />
            </div>
          </div>
        </div>

        {/* History Table */}
        {historyMemberId && historyMemberId.trim().length > 0 ? (
          <EligibilityHistory
            memberId={historyMemberId.trim()}
            showHeader={true}
            title="Eligibility History"
            showExport={true}
            showReverificationStatus={true}
            compact={false}
            initialPageSize={10}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <svg
              className="w-14 h-14 text-gray-300 mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Enter a Member ID</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
              Enter a member ID above to view their eligibility validation history and re-verification status.
            </p>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Annual Re-verification tab content.
   * @returns {React.ReactElement}
   */
  function renderReverificationTab() {
    return (
      <ReverificationPanel
        showHeader={true}
        title="Annual Re-Verification"
        showExport={true}
        showBatchActions={isAuthenticated}
        compact={false}
        initialPageSize={10}
        refreshInterval={0}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'validate',
        label: 'Validate Eligibility',
        icon: (
          <svg
            width="14"
            height="14"
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
        ),
        content: renderValidateTab(),
      },
      {
        key: 'history',
        label: 'Eligibility History',
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: renderHistoryTab(),
      },
      {
        key: 'reverification',
        label: 'Annual Re-Verification',
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
        ),
        content: renderReverificationTab(),
      },
    ];
  }, [validationResult, validatedMemberId, validatedEffectiveDate, validatedRetroDate, historyMemberId, isAuthenticated]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
            <svg
              width="20"
              height="20"
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
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Eligibility Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Validate member eligibility for C-SNP enrollment, review eligibility history, and manage annual re-verifications.
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs
        tabs={tabs}
        defaultActiveKey="validate"
        variant="underline"
        size="md"
      />

      {/* CMS Compliance Notice */}
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
          Eligibility validation is required for all C-SNP enrollment applications per CMS regulations
          (42 CFR §422.52). Members must have at least one qualifying chronic condition diagnosis code
          (ICD-10-CM) to be eligible for C-SNP enrollment. Annual re-verification of chronic condition
          diagnosis is mandated to maintain enrollment eligibility. All eligibility validations are
          logged in the audit trail.
        </p>
      </div>
    </div>
  );
}