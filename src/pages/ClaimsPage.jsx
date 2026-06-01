import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import ClaimsList from '../components/claims/ClaimsList.jsx';
import ClaimForm from '../components/claims/ClaimForm.jsx';
import ClaimDetail from '../components/claims/ClaimDetail.jsx';
import AdjudicationPanel from '../components/claims/AdjudicationPanel.jsx';

/**
 * Claims processing page with tabbed interface.
 * Tab 1: Claims List (ClaimsList) with New Claim button
 * Tab 2: New Claim (ClaimForm)
 * Tab 3: Adjudication Panel (AdjudicationPanel) - shown when a claim is selected for adjudication
 *
 * Supports:
 * - Claims list with status filtering and search via ClaimsList
 * - Row selection to open ClaimDetail view
 * - New Claim button opening ClaimForm in a dedicated tab
 * - Adjudication panel for manual override and rule evaluation
 * - Claim status tracking across all statuses
 *
 * @returns {React.ReactElement}
 */
export default function ClaimsPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('list');

  // Detail view state
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  // Adjudication view state
  const [adjudicationClaimId, setAdjudicationClaimId] = useState(null);

  /**
   * Handles selecting a claim record from the list.
   * Opens the detail view for the selected claim.
   * @param {Object} record - The claim record
   */
  const handleRecordSelect = useCallback((record) => {
    if (record && record.id) {
      setSelectedClaimId(record.id);
      setDetailViewOpen(true);
    }
  }, []);

  /**
   * Handles closing the detail view.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailViewOpen(false);
    setSelectedClaimId(null);
  }, []);

  /**
   * Handles claim status change from the detail view.
   * @param {Object} result - The status change result
   */
  const handleStatusChange = useCallback((result) => {
    if (result) {
      addNotification(
        'success',
        'Claim Updated',
        'Claim status has been updated successfully.'
      );
    }
  }, [addNotification]);

  /**
   * Handles clicking the New Claim button.
   * Switches to the new claim tab.
   */
  const handleNewClaim = useCallback(() => {
    setActiveTab('new');
  }, []);

  /**
   * Handles claim submission completion from the claim form.
   * Switches back to the list tab after successful submission.
   * @param {Object} result - The claim submission result
   */
  const handleClaimSubmitted = useCallback((result) => {
    if (result && result.success) {
      setActiveTab('list');
    }
  }, []);

  /**
   * Handles opening the adjudication panel for a claim.
   * Switches to the adjudication tab with the selected claim ID.
   * @param {string} claimId - The claim ID to adjudicate
   */
  const handleOpenAdjudication = useCallback((claimId) => {
    if (claimId) {
      setAdjudicationClaimId(claimId);
      setDetailViewOpen(false);
      setSelectedClaimId(null);
      setActiveTab('adjudication');
    }
  }, []);

  /**
   * Handles adjudication status change.
   * @param {Object} result - The adjudication result
   */
  const handleAdjudicationStatusChange = useCallback((result) => {
    if (result) {
      addNotification(
        'success',
        'Adjudication Updated',
        'Claim adjudication has been updated successfully.'
      );
    }
  }, [addNotification]);

  /**
   * Handles closing the adjudication panel.
   * Switches back to the list tab.
   */
  const handleCloseAdjudication = useCallback(() => {
    setAdjudicationClaimId(null);
    setActiveTab('list');
  }, []);

  /**
   * Renders the Claims List tab content.
   * @returns {React.ReactElement}
   */
  function renderListTab() {
    return (
      <ClaimsList
        showHeader={true}
        title="Claims"
        showExport={true}
        showStats={true}
        compact={false}
        initialPageSize={20}
        onRecordSelect={handleRecordSelect}
        headerActions={
          isAuthenticated && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNewClaim}
              iconLeft={
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
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              New Claim
            </Button>
          )
        }
      />
    );
  }

  /**
   * Renders the New Claim tab content.
   * @returns {React.ReactElement}
   */
  function renderNewClaimTab() {
    return (
      <ClaimForm
        showHeader={true}
        autoProcess={false}
        onClaimSubmitted={handleClaimSubmitted}
      />
    );
  }

  /**
   * Renders the Adjudication tab content.
   * @returns {React.ReactElement}
   */
  function renderAdjudicationTab() {
    if (!adjudicationClaimId) {
      return (
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-sm font-medium text-gray-500">No Claim Selected</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
            Select a claim from the Claims List and open its detail view to access the adjudication panel.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('list')}
            className="mt-4"
          >
            Go to Claims List
          </Button>
        </div>
      );
    }

    return (
      <AdjudicationPanel
        claimId={adjudicationClaimId}
        showHeader={true}
        showActions={isAuthenticated}
        showAuditHistory={true}
        showManualOverride={isAuthenticated}
        compact={false}
        onStatusChange={handleAdjudicationStatusChange}
        onClose={handleCloseAdjudication}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'list',
        label: 'Claims List',
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
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        ),
        content: renderListTab(),
      },
      {
        key: 'new',
        label: 'New Claim',
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ),
        content: renderNewClaimTab(),
      },
      {
        key: 'adjudication',
        label: 'Adjudication',
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: renderAdjudicationTab(),
      },
    ];

    return tabList;
  }, [isAuthenticated, adjudicationClaimId, handleRecordSelect, handleNewClaim, handleClaimSubmitted, handleAdjudicationStatusChange, handleCloseAdjudication]);

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
              <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Claims Processing
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage C-SNP claims, process adjudication, track claim statuses, and handle manual overrides.
            </p>
          </div>
        </div>
      </div>

      {/* Detail View */}
      {detailViewOpen && selectedClaimId && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
          <ClaimDetail
            claimId={selectedClaimId}
            showHeader={true}
            showActions={isAuthenticated}
            showAuditHistory={true}
            onStatusChange={handleStatusChange}
            onClose={handleCloseDetail}
          />

          {/* Adjudication Quick Action */}
          {isAuthenticated && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Need to review adjudication rules, pricing, or apply a manual override?
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenAdjudication(selectedClaimId)}
                  iconLeft={
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                >
                  Open Adjudication Panel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabbed Interface (hidden when detail view is open) */}
      {!detailViewOpen && (
        <Tabs
          tabs={tabs}
          activeKey={activeTab}
          onChange={setActiveTab}
          variant="underline"
          size="md"
        />
      )}

      {/* CMS Compliance Notice */}
      {!detailViewOpen && (
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
            All C-SNP claims are processed through CSNP-specific adjudication rules per CMS regulations
            (42 CFR §422.100). Claims must include valid ICD-10 diagnosis codes, be associated with an
            active enrollment, and comply with plan-based pricing and authorization requirements. Manual
            overrides require documented justification and are subject to supervisory review. All claim
            actions are logged in the audit trail.
          </p>
        </div>
      )}
    </div>
  );
}