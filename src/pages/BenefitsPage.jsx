import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import BenefitPackageList from '../components/benefits/BenefitPackageList.jsx';
import BenefitPackageForm from '../components/benefits/BenefitPackageForm.jsx';
import BenefitDetail from '../components/benefits/BenefitDetail.jsx';
import CoverageRulesEditor from '../components/benefits/CoverageRulesEditor.jsx';

/**
 * Benefits configuration page with tabbed interface.
 * Tab 1: Benefit Packages List (BenefitPackageList) with New Package button
 * Tab 2: Create/Edit Benefit Package (BenefitPackageForm)
 * Tab 3: Coverage Rules Editor (CoverageRulesEditor)
 *
 * Supports:
 * - Condition-based filtering and plan type selection via BenefitPackageList
 * - Row selection to open BenefitDetail view
 * - New Package button opening BenefitPackageForm in a dedicated tab
 * - Coverage rules visual builder
 *
 * @returns {React.ReactElement}
 */
export default function BenefitsPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('list');

  // Detail view state
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  // Edit mode state
  const [editingPackageId, setEditingPackageId] = useState(null);

  // Coverage rules state
  const [coverageRules, setCoverageRules] = useState([]);

  /**
   * Handles selecting a benefit package record from the list.
   * Opens the detail view for the selected package.
   * @param {Object} record - The benefit package record
   */
  const handleRecordSelect = useCallback((record) => {
    if (record && record.id) {
      setSelectedPackageId(record.id);
      setDetailViewOpen(true);
    }
  }, []);

  /**
   * Handles closing the detail view.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailViewOpen(false);
    setSelectedPackageId(null);
  }, []);

  /**
   * Handles clicking the New Package button.
   * Switches to the create tab with no editing package.
   */
  const handleNewPackage = useCallback(() => {
    setEditingPackageId(null);
    setActiveTab('create');
  }, []);

  /**
   * Handles editing a package from the list or detail view.
   * Switches to the create tab with the editing package ID.
   * @param {Object} record - The benefit package record
   */
  const handleEditPackage = useCallback((record) => {
    if (record && record.id) {
      setEditingPackageId(record.id);
      setActiveTab('create');
    }
  }, []);

  /**
   * Handles editing from the detail view.
   * @param {string} packageId - The benefit package ID
   */
  const handleEditFromDetail = useCallback((packageId) => {
    if (packageId) {
      setEditingPackageId(packageId);
      setDetailViewOpen(false);
      setSelectedPackageId(null);
      setActiveTab('create');
    }
  }, []);

  /**
   * Handles cloning a package from the list.
   * @param {Object} record - The benefit package record to clone
   */
  const handleClonePackage = useCallback((record) => {
    if (record) {
      addNotification(
        'info',
        'Package Cloned',
        `Benefit package "${record.name}" has been cloned. The cloned package will appear in the list.`
      );
    }
  }, [addNotification]);

  /**
   * Handles save completion from the benefit package form.
   * Switches back to the list tab after successful save.
   * @param {Object} result - The save result
   */
  const handleSaveComplete = useCallback((result) => {
    if (result && result.success) {
      setEditingPackageId(null);
      setActiveTab('list');
    }
  }, []);

  /**
   * Handles cancel from the benefit package form.
   * Switches back to the list tab.
   */
  const handleCancelForm = useCallback(() => {
    setEditingPackageId(null);
    setActiveTab('list');
  }, []);

  /**
   * Handles coverage rules changes.
   * @param {Object[]} rules - The updated rules array
   */
  const handleRulesChange = useCallback((rules) => {
    setCoverageRules(rules);
  }, []);

  /**
   * Renders the Benefit Packages List tab content.
   * @returns {React.ReactElement}
   */
  function renderListTab() {
    return (
      <BenefitPackageList
        showHeader={true}
        title="Benefit Packages"
        showExport={true}
        showStats={true}
        compact={false}
        initialPageSize={20}
        onRecordSelect={handleRecordSelect}
        onEdit={handleEditPackage}
        onClone={handleClonePackage}
        headerActions={
          isAuthenticated && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNewPackage}
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
              New Package
            </Button>
          )
        }
      />
    );
  }

  /**
   * Renders the Create/Edit Benefit Package tab content.
   * @returns {React.ReactElement}
   */
  function renderCreateTab() {
    return (
      <BenefitPackageForm
        packageId={editingPackageId || undefined}
        onSave={handleSaveComplete}
        onCancel={handleCancelForm}
        showHeader={true}
      />
    );
  }

  /**
   * Renders the Coverage Rules Editor tab content.
   * @returns {React.ReactElement}
   */
  function renderCoverageRulesTab() {
    return (
      <CoverageRulesEditor
        initialRules={coverageRules}
        onRulesChange={handleRulesChange}
        showHeader={true}
        showStats={true}
        disabled={!isAuthenticated}
        compact={false}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'list',
        label: 'Benefit Packages',
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
        key: 'create',
        label: editingPackageId ? 'Edit Package' : 'New Package',
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
            {editingPackageId ? (
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </>
            )}
          </svg>
        ),
        content: renderCreateTab(),
      },
      {
        key: 'rules',
        label: 'Coverage Rules',
        badge: coverageRules.length > 0 ? String(coverageRules.length) : undefined,
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
        content: renderCoverageRulesTab(),
      },
    ];
  }, [isAuthenticated, editingPackageId, coverageRules, handleRecordSelect, handleEditPackage, handleClonePackage, handleNewPackage, handleSaveComplete, handleCancelForm, handleRulesChange]);

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
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Benefits Configuration
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Configure C-SNP benefit packages, copay schedules, coverage rules, and condition-specific supplemental benefits.
            </p>
          </div>
        </div>
      </div>

      {/* Detail View */}
      {detailViewOpen && selectedPackageId && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
          <BenefitDetail
            packageId={selectedPackageId}
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
            All C-SNP benefit packages must comply with CMS regulations (42 CFR §422.4). Packages must
            include condition-specific supplemental benefits, care coordination services, and meet CMS
            maximum out-of-pocket limits. Copay and coinsurance amounts are subject to annual CMS review
            and approval. Coverage rules must align with the plan&apos;s eligible chronic condition categories.
            All benefit configuration changes are logged in the audit trail.
          </p>
        </div>
      )}
    </div>
  );
}