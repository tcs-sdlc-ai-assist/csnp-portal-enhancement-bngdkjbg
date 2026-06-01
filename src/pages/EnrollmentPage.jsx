import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import EnrollmentForm from '../components/enrollment/EnrollmentForm.jsx';
import EnrollmentList from '../components/enrollment/EnrollmentList.jsx';
import EnrollmentDetail from '../components/enrollment/EnrollmentDetail.jsx';

/**
 * Enrollment management page with tabbed interface.
 * Tab 1: Enrollment List (EnrollmentList) with New Enrollment button
 * Tab 2: New Enrollment (EnrollmentForm)
 *
 * Supports:
 * - Channel filtering and status tracking via EnrollmentList
 * - Row selection to open EnrollmentDetail view
 * - New Enrollment button opening EnrollmentForm in a dedicated tab
 *
 * @returns {React.ReactElement}
 */
export default function EnrollmentPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('list');

  // Detail view state
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  /**
   * Handles selecting an enrollment record from the list.
   * Opens the detail view for the selected enrollment.
   * @param {Object} record - The enrollment record
   */
  const handleRecordSelect = useCallback((record) => {
    if (record && record.id) {
      setSelectedEnrollmentId(record.id);
      setDetailViewOpen(true);
    }
  }, []);

  /**
   * Handles closing the detail view.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailViewOpen(false);
    setSelectedEnrollmentId(null);
  }, []);

  /**
   * Handles enrollment status change from the detail view.
   * @param {Object} result - The status change result
   */
  const handleStatusChange = useCallback((result) => {
    if (result && result.success !== false) {
      addNotification(
        'success',
        'Enrollment Updated',
        'Enrollment status has been updated successfully.'
      );
    }
  }, [addNotification]);

  /**
   * Handles enrollment completion from the enrollment form.
   * Switches back to the list tab after successful enrollment.
   * @param {Object} result - The enrollment result
   */
  const handleEnrollmentComplete = useCallback((result) => {
    if (result && result.success) {
      setActiveTab('list');
    }
  }, []);

  /**
   * Handles clicking the New Enrollment button.
   * Switches to the new enrollment tab.
   */
  const handleNewEnrollment = useCallback(() => {
    setActiveTab('new');
  }, []);

  /**
   * Renders the Enrollment List tab content.
   * @returns {React.ReactElement}
   */
  function renderListTab() {
    return (
      <EnrollmentList
        showHeader={true}
        title="Enrollments"
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
              onClick={handleNewEnrollment}
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
                  <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
            >
              New Enrollment
            </Button>
          )
        }
      />
    );
  }

  /**
   * Renders the New Enrollment tab content.
   * @returns {React.ReactElement}
   */
  function renderNewEnrollmentTab() {
    return (
      <EnrollmentForm
        showHeader={true}
        onEnrollmentComplete={handleEnrollmentComplete}
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
        label: 'Enrollment List',
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
        label: 'New Enrollment',
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
            <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
        content: renderNewEnrollmentTab(),
      },
    ];
  }, [isAuthenticated, handleRecordSelect, handleNewEnrollment, handleEnrollmentComplete]);

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
              <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Enrollment Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage C-SNP enrollment applications, track statuses, process documents, and submit to CMS.
            </p>
          </div>
        </div>
      </div>

      {/* Detail View */}
      {detailViewOpen && selectedEnrollmentId && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
          <EnrollmentDetail
            enrollmentId={selectedEnrollmentId}
            showHeader={true}
            showActions={isAuthenticated}
            showTimeline={true}
            onStatusChange={handleStatusChange}
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
            All C-SNP enrollment applications are processed in compliance with CMS regulations
            (42 CFR §422.52). Enrollment intake supports multiple channels (online, phone, mail,
            in-person, broker). Documents are validated through the VCC (Verification &amp; Compliance Center),
            member data is enriched via ICoE (Integration Center of Excellence), and submissions are
            processed through IKA (Integration Key Architecture) for CMS approval. TRR (Transaction Reply Report)
            responses are tracked for each enrollment. All enrollment actions are logged in the audit trail.
          </p>
        </div>
      )}
    </div>
  );
}