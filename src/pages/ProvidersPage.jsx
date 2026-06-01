import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import ProviderList from '../components/providers/ProviderList.jsx';
import ProviderForm from '../components/providers/ProviderForm.jsx';
import ProviderDetail from '../components/providers/ProviderDetail.jsx';
import PCPAssignment from '../components/providers/PCPAssignment.jsx';
import ReferralManagement from '../components/providers/ReferralManagement.jsx';

/**
 * Provider network management page with tabbed interface.
 * Tab 1: Provider Directory (ProviderList) with Add Provider button
 * Tab 2: Add/Edit Provider (ProviderForm)
 * Tab 3: PCP Assignment (PCPAssignment)
 * Tab 4: Referral Management (ReferralManagement)
 *
 * Supports:
 * - Provider directory with specialty/network filtering via ProviderList
 * - Row selection to open ProviderDetail view
 * - Add Provider button opening ProviderForm in a dedicated tab
 * - Edit Provider from list or detail view
 * - PCP assignment management for members
 * - Referral creation and tracking
 *
 * @returns {React.ReactElement}
 */
export default function ProvidersPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('directory');

  // Detail view state
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  // Edit mode state
  const [editingProviderId, setEditingProviderId] = useState(null);

  /**
   * Handles selecting a provider record from the list.
   * Opens the detail view for the selected provider.
   * @param {Object} record - The provider record
   */
  const handleRecordSelect = useCallback((record) => {
    if (record && record.id) {
      setSelectedProviderId(record.id);
      setDetailViewOpen(true);
    }
  }, []);

  /**
   * Handles closing the detail view.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailViewOpen(false);
    setSelectedProviderId(null);
  }, []);

  /**
   * Handles clicking the Add Provider button.
   * Switches to the add/edit tab with no editing provider.
   */
  const handleAddProvider = useCallback(() => {
    setEditingProviderId(null);
    setActiveTab('form');
  }, []);

  /**
   * Handles editing a provider from the list.
   * Switches to the add/edit tab with the editing provider ID.
   * @param {Object} record - The provider record
   */
  const handleEditProvider = useCallback((record) => {
    if (record && record.id) {
      setEditingProviderId(record.id);
      setActiveTab('form');
    }
  }, []);

  /**
   * Handles editing from the detail view.
   * @param {string} providerId - The provider ID
   */
  const handleEditFromDetail = useCallback((providerId) => {
    if (providerId) {
      setEditingProviderId(providerId);
      setDetailViewOpen(false);
      setSelectedProviderId(null);
      setActiveTab('form');
    }
  }, []);

  /**
   * Handles save completion from the provider form.
   * Switches back to the directory tab after successful save.
   * @param {Object} result - The save result
   */
  const handleSaveComplete = useCallback((result) => {
    if (result && result.success) {
      setEditingProviderId(null);
      setActiveTab('directory');
    }
  }, []);

  /**
   * Handles cancel from the provider form.
   * Switches back to the directory tab.
   */
  const handleCancelForm = useCallback(() => {
    setEditingProviderId(null);
    setActiveTab('directory');
  }, []);

  /**
   * Handles PCP assignment changes.
   * @param {Object} result - The assignment change result
   */
  const handleAssignmentChange = useCallback((result) => {
    if (result && result.success) {
      addNotification(
        'success',
        'PCP Assignment Updated',
        'The PCP assignment has been updated successfully.'
      );
    }
  }, [addNotification]);

  /**
   * Handles referral changes.
   * @param {Object} result - The referral change result
   */
  const handleReferralChange = useCallback((result) => {
    if (result && result.success) {
      addNotification(
        'success',
        'Referral Updated',
        'The referral has been updated successfully.'
      );
    }
  }, [addNotification]);

  /**
   * Renders the Provider Directory tab content.
   * @returns {React.ReactElement}
   */
  function renderDirectoryTab() {
    return (
      <ProviderList
        showHeader={true}
        title="Provider Network"
        showExport={true}
        showStats={true}
        compact={false}
        initialPageSize={20}
        onRecordSelect={handleRecordSelect}
        onEdit={handleEditProvider}
        headerActions={
          isAuthenticated && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddProvider}
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
              Add Provider
            </Button>
          )
        }
      />
    );
  }

  /**
   * Renders the Add/Edit Provider tab content.
   * @returns {React.ReactElement}
   */
  function renderFormTab() {
    return (
      <ProviderForm
        providerId={editingProviderId || undefined}
        onSave={handleSaveComplete}
        onCancel={handleCancelForm}
        showHeader={true}
      />
    );
  }

  /**
   * Renders the PCP Assignment tab content.
   * @returns {React.ReactElement}
   */
  function renderPCPAssignmentTab() {
    return (
      <PCPAssignment
        showHeader={true}
        showHistory={true}
        showEligibleOnly={false}
        compact={false}
        onAssignmentChange={handleAssignmentChange}
      />
    );
  }

  /**
   * Renders the Referral Management tab content.
   * @returns {React.ReactElement}
   */
  function renderReferralTab() {
    return (
      <ReferralManagement
        showHeader={true}
        title="Referral Management"
        showExport={true}
        showStats={true}
        showCreateButton={isAuthenticated}
        compact={false}
        initialPageSize={20}
        onReferralChange={handleReferralChange}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'directory',
        label: 'Provider Directory',
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
            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        content: renderDirectoryTab(),
      },
      {
        key: 'form',
        label: editingProviderId ? 'Edit Provider' : 'Add Provider',
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
            {editingProviderId ? (
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </>
            )}
          </svg>
        ),
        content: renderFormTab(),
      },
      {
        key: 'pcp',
        label: 'PCP Assignment',
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
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: renderPCPAssignmentTab(),
      },
      {
        key: 'referrals',
        label: 'Referral Management',
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
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
        content: renderReferralTab(),
      },
    ];
  }, [isAuthenticated, editingProviderId, handleRecordSelect, handleEditProvider, handleAddProvider, handleSaveComplete, handleCancelForm, handleAssignmentChange, handleReferralChange]);

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
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Provider Network
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage the C-SNP provider network, PCP assignments, referrals, and provider contracts.
            </p>
          </div>
        </div>
      </div>

      {/* Detail View */}
      {detailViewOpen && selectedProviderId && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
          <ProviderDetail
            providerId={selectedProviderId}
            showHeader={true}
            showActions={isAuthenticated}
            showAuditHistory={true}
            onEdit={handleEditFromDetail}
            onClose={handleCloseDetail}
          />
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
            C-SNP provider networks must meet CMS network adequacy requirements (42 CFR §422.116).
            All providers must have valid NPI numbers, active contracts within effective date ranges,
            and appropriate specialty coverage for the chronic conditions served by the plan. PCP
            assignments must comply with network restrictions, and referrals must be tracked for
            care coordination compliance. Conduct quarterly network adequacy assessments to ensure
            continued compliance. All provider network changes are logged in the audit trail.
          </p>
        </div>
      )}
    </div>
  );
}