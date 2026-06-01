import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import ComplianceDashboard from '../components/compliance/ComplianceDashboard.jsx';
import AuditLogViewer from '../components/compliance/AuditLogViewer.jsx';
import CMSReportGenerator from '../components/compliance/CMSReportGenerator.jsx';
import WeeklyAuditReport from '../components/compliance/WeeklyAuditReport.jsx';

/**
 * Compliance and reporting page with tabbed interface.
 * Tab 1: Compliance Dashboard (ComplianceDashboard)
 * Tab 2: Audit Logs (AuditLogViewer)
 * Tab 3: CMS Reports (CMSReportGenerator)
 * Tab 4: Weekly Audit (WeeklyAuditReport)
 *
 * Displays overall compliance status, CMS regulation adherence,
 * audit trail viewer, report generation, and weekly audit findings.
 *
 * @returns {React.ReactElement}
 */
export default function CompliancePage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  /**
   * Handles audit completion from the WeeklyAuditReport.
   * @param {Object} result - The audit result
   */
  const handleAuditComplete = useCallback((result) => {
    if (result && result.success) {
      addNotification(
        'success',
        'Audit Complete',
        `Weekly compliance audit completed. Status: ${result.complianceLevel || 'unknown'}.`
      );
    }
  }, [addNotification]);

  /**
   * Handles report generation completion from the CMSReportGenerator.
   * @param {Object} result - The report generation result
   */
  const handleReportGenerated = useCallback((result) => {
    if (result && result.success) {
      addNotification(
        'success',
        'Report Generated',
        `${result.reportTypeLabel || 'CMS Report'} has been generated successfully.`
      );
    }
  }, [addNotification]);

  /**
   * Renders the Compliance Dashboard tab content.
   * @returns {React.ReactElement}
   */
  function renderDashboardTab() {
    return (
      <ComplianceDashboard
        showHeader={true}
        title="Compliance Dashboard"
        showModuleBreakdown={true}
        showAuditSchedule={true}
        showReverificationStats={true}
        showTrend={true}
        showAuditHistory={true}
        showAuditButton={isAuthenticated}
        compact={false}
        refreshInterval={0}
      />
    );
  }

  /**
   * Renders the Audit Logs tab content.
   * @returns {React.ReactElement}
   */
  function renderAuditLogsTab() {
    return (
      <AuditLogViewer
        showHeader={true}
        title="Audit Log"
        showExport={true}
        showStats={true}
        showIntegrityCheck={isAuthenticated}
        showFilters={true}
        compact={false}
        initialPageSize={20}
        refreshInterval={0}
      />
    );
  }

  /**
   * Renders the CMS Reports tab content.
   * @returns {React.ReactElement}
   */
  function renderCMSReportsTab() {
    return (
      <CMSReportGenerator
        showHeader={true}
        showReportTypeCards={true}
        showHistory={true}
        compact={false}
        onReportGenerated={handleReportGenerated}
      />
    );
  }

  /**
   * Renders the Weekly Audit tab content.
   * @returns {React.ReactElement}
   */
  function renderWeeklyAuditTab() {
    return (
      <WeeklyAuditReport
        showHeader={true}
        title="Weekly Audit Report"
        showRunAuditButton={isAuthenticated}
        showHistory={true}
        showModuleBreakdown={true}
        showExport={true}
        compact={false}
        onAuditComplete={handleAuditComplete}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'dashboard',
        label: 'Compliance Dashboard',
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
        content: renderDashboardTab(),
      },
      {
        key: 'audit_logs',
        label: 'Audit Logs',
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
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
        content: renderAuditLogsTab(),
      },
      {
        key: 'cms_reports',
        label: 'CMS Reports',
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
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
        content: renderCMSReportsTab(),
      },
      {
        key: 'weekly_audit',
        label: 'Weekly Audit',
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
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        content: renderWeeklyAuditTab(),
      },
    ];
  }, [isAuthenticated, handleAuditComplete, handleReportGenerated]);

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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Compliance & Reporting
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Monitor CMS C-SNP compliance status, review audit trails, generate regulatory reports, and manage weekly compliance audits.
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs
        tabs={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
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
          This module monitors compliance with CMS regulations for Chronic Condition Special Needs Plans
          (42 CFR §422.4). Weekly compliance audits are required to ensure adherence to enrollment integrity,
          claims processing, eligibility verification, provider network adequacy, care management engagement,
          and audit trail integrity requirements. Annual member re-verification of chronic condition diagnosis
          is mandated per 42 CFR §422.52. All compliance activities are logged in the audit trail. CMS reports
          should be generated regularly for compliance monitoring and submitted as required by the plan&apos;s
          reporting schedule.
        </p>
      </div>
    </div>
  );
}