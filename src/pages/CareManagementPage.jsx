import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import StatsCard from '../components/dashboard/StatsCard.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Alert from '../components/common/Alert.jsx';
import CareEventTrigger from '../components/careManagement/CareEventTrigger.jsx';
import CarePlanView from '../components/careManagement/CarePlanView.jsx';
import CareManagerAssignment from '../components/careManagement/CareManagerAssignment.jsx';
import AlertsTasksList from '../components/careManagement/AlertsTasksList.jsx';
import HRAForm from '../components/careManagement/HRAForm.jsx';
import { getCareManagementStats } from '../services/careManagementService.js';
import { formatRelativeTime, toTitleCase } from '../utils/helpers.js';

/**
 * Care management page with tabbed interface.
 * Tab 1: Event Triggers (CareEventTrigger)
 * Tab 2: Care Plans (CarePlanView)
 * Tab 3: Care Manager Assignment (CareManagerAssignment)
 * Tab 4: Alerts & Tasks (AlertsTasksList)
 * Tab 5: Health Risk Assessment (HRAForm)
 *
 * Displays care management dashboard metrics at the top.
 *
 * @returns {React.ReactElement}
 */
export default function CareManagementPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('events');

  // Care plan member ID state
  const [carePlanMemberId, setCarePlanMemberId] = useState('');

  // Dashboard stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /**
   * Loads care management statistics.
   */
  const loadStats = useCallback(() => {
    setStatsLoading(true);

    try {
      const careStats = getCareManagementStats();
      setStats(careStats);
    } catch (err) {
      console.error('CareManagementPage: failed to load stats:', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /**
   * Handles care event trigger completion.
   * @param {Object} result - The trigger result
   */
  const handleTriggerComplete = useCallback((result) => {
    if (result && result.success) {
      loadStats();
    }
  }, [loadStats]);

  /**
   * Handles care plan changes.
   * @param {Object} result - The care plan change result
   */
  const handleCarePlanChange = useCallback((result) => {
    if (result) {
      loadStats();
    }
  }, [loadStats]);

  /**
   * Handles care manager assignment changes.
   * @param {Object} result - The assignment change result
   */
  const handleAssignmentChange = useCallback((result) => {
    if (result && result.success) {
      loadStats();
    }
  }, [loadStats]);

  /**
   * Handles alert actions.
   * @param {string} action - The action performed
   * @param {string} alertId - The alert ID
   */
  const handleAlertAction = useCallback((action, alertId) => {
    loadStats();
  }, [loadStats]);

  /**
   * Handles task actions.
   * @param {string} action - The action performed
   * @param {string} taskId - The task ID
   */
  const handleTaskAction = useCallback((action, taskId) => {
    loadStats();
  }, [loadStats]);

  /**
   * Handles HRA completion.
   * @param {Object} result - The HRA result
   */
  const handleHRAComplete = useCallback((result) => {
    if (result && result.success) {
      loadStats();
    }
  }, [loadStats]);

  /**
   * Renders the Event Triggers tab content.
   * @returns {React.ReactElement}
   */
  function renderEventsTab() {
    return (
      <CareEventTrigger
        showHeader={true}
        showEventTypeCards={true}
        compact={false}
        onTriggerComplete={handleTriggerComplete}
      />
    );
  }

  /**
   * Renders the Care Plans tab content.
   * @returns {React.ReactElement}
   */
  function renderCarePlansTab() {
    return (
      <div className="space-y-4">
        {/* Member ID Input for Care Plan */}
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label htmlFor="care-plan-member-id" className="font-medium text-sm text-gray-700 mb-1 block">
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
                id="care-plan-member-id"
                type="text"
                value={carePlanMemberId}
                onChange={(e) => setCarePlanMemberId(e.target.value)}
                placeholder="Enter member ID to view care plan"
                className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200"
                aria-label="Member ID for care plan"
              />
            </div>
          </div>
        </div>

        {/* Care Plan View */}
        {carePlanMemberId && carePlanMemberId.trim().length > 0 ? (
          <CarePlanView
            memberId={carePlanMemberId.trim()}
            showHeader={true}
            showCareTeam={true}
            showTimeline={true}
            showTasks={true}
            showAlerts={true}
            showActions={isAuthenticated}
            compact={false}
            onCarePlanChange={handleCarePlanChange}
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
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Enter a Member ID</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
              Enter a member ID above to view their individualized care plan, goals, care team, tasks, and timeline.
            </p>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Care Manager Assignment tab content.
   * @returns {React.ReactElement}
   */
  function renderAssignmentTab() {
    return (
      <CareManagerAssignment
        showHeader={true}
        showHistory={true}
        showCaseloadStats={true}
        compact={false}
        onAssignmentChange={handleAssignmentChange}
      />
    );
  }

  /**
   * Renders the Alerts & Tasks tab content.
   * @returns {React.ReactElement}
   */
  function renderAlertsTasksTab() {
    return (
      <AlertsTasksList
        showHeader={true}
        title="Alerts & Tasks"
        showStats={true}
        showAlerts={true}
        showTasks={true}
        compact={false}
        initialPageSize={10}
        refreshInterval={0}
        onAlertAction={handleAlertAction}
        onTaskAction={handleTaskAction}
      />
    );
  }

  /**
   * Renders the HRA tab content.
   * @returns {React.ReactElement}
   */
  function renderHRATab() {
    return (
      <HRAForm
        showHeader={true}
        showPreviousHRA={true}
        compact={false}
        onHRAComplete={handleHRAComplete}
      />
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'events',
        label: 'Event Triggers',
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
        content: renderEventsTab(),
      },
      {
        key: 'care_plans',
        label: 'Care Plans',
        badge: stats && stats.activeCarePlans > 0 ? String(stats.activeCarePlans) : undefined,
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
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        content: renderCarePlansTab(),
      },
      {
        key: 'assignment',
        label: 'Care Manager Assignment',
        badge: stats && stats.activeCareManagerAssignments > 0 ? String(stats.activeCareManagerAssignments) : undefined,
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
        content: renderAssignmentTab(),
      },
      {
        key: 'alerts_tasks',
        label: 'Alerts & Tasks',
        badge: stats && (stats.activeAlerts + stats.pendingTasks) > 0
          ? String(stats.activeAlerts + stats.pendingTasks)
          : undefined,
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
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        ),
        content: renderAlertsTasksTab(),
      },
      {
        key: 'hra',
        label: 'Health Risk Assessment',
        badge: stats && stats.totalHRAs > 0 ? String(stats.totalHRAs) : undefined,
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
        content: renderHRATab(),
      },
    ];
  }, [stats, carePlanMemberId, isAuthenticated, handleTriggerComplete, handleCarePlanChange, handleAssignmentChange, handleAlertAction, handleTaskAction, handleHRAComplete]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center justify-between">
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
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
                Care Management
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Manage care events, care plans, care manager assignments, alerts, tasks, and health risk assessments for C-SNP members.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadStats}
              disabled={statsLoading}
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
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
              }
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Metrics */}
      {statsLoading && !stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Care Events */}
          <StatsCard
            label="Care Events"
            value={String(stats.totalCareEvents)}
            trend={stats.totalCareEvents > 0 ? 'up' : 'neutral'}
            trendValue={stats.totalCareEvents > 0 ? `${stats.totalCareEvents} total` : ''}
            description={`${stats.activeCarePlans} active care plan${stats.activeCarePlans !== 1 ? 's' : ''}`}
            iconVariant="primary"
            hoverable={true}
            onClick={() => setActiveTab('events')}
            icon={
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
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />

          {/* Active Alerts */}
          <StatsCard
            label="Active Alerts"
            value={String(stats.activeAlerts)}
            trend={stats.activeAlerts > 0 ? 'down' : 'up'}
            trendValue={stats.activeAlerts > 0 ? `${stats.activeAlerts} active` : 'No alerts'}
            description={`${stats.totalAlerts} total alert${stats.totalAlerts !== 1 ? 's' : ''}`}
            iconVariant={stats.activeAlerts > 0 ? 'warning' : 'success'}
            hoverable={true}
            onClick={() => setActiveTab('alerts_tasks')}
            icon={
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
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            }
          />

          {/* Pending Tasks */}
          <StatsCard
            label="Pending Tasks"
            value={String(stats.pendingTasks)}
            trend={stats.pendingTasks > 0 ? 'down' : 'up'}
            trendValue={stats.completedTasks > 0 ? `${stats.completedTasks} completed` : ''}
            description={`${stats.totalTasks} total task${stats.totalTasks !== 1 ? 's' : ''}`}
            iconVariant={stats.pendingTasks > 0 ? 'warning' : 'success'}
            hoverable={true}
            onClick={() => setActiveTab('alerts_tasks')}
            icon={
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
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />

          {/* HRAs Completed */}
          <StatsCard
            label="HRAs Completed"
            value={String(stats.totalHRAs)}
            trend={stats.totalHRAs > 0 ? 'up' : 'neutral'}
            trendValue={stats.activeCareManagerAssignments > 0 ? `${stats.activeCareManagerAssignments} CM assigned` : ''}
            description={`${stats.totalCarePlans} care plan${stats.totalCarePlans !== 1 ? 's' : ''} generated`}
            iconVariant="info"
            hoverable={true}
            onClick={() => setActiveTab('hra')}
            icon={
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
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
          />
        </div>
      )}

      {/* Active Alerts Banner */}
      {stats && stats.activeAlerts > 0 && (
        <Alert
          variant="warning"
          title={`${stats.activeAlerts} Active Care Alert${stats.activeAlerts !== 1 ? 's' : ''}`}
          showIcon={true}
          bordered={true}
          size="sm"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('alerts_tasks')}
            >
              View Alerts
            </Button>
          }
        >
          {stats.pendingTasks > 0
            ? `${stats.pendingTasks} pending task${stats.pendingTasks !== 1 ? 's' : ''} also require attention.`
            : 'Review and acknowledge active care management alerts.'}
        </Alert>
      )}

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
          Care management activities are tracked per CMS C-SNP requirements (42 CFR §422.101).
          All C-SNP members must have an assigned care manager, an individualized care plan with
          condition-specific goals, and regular health risk assessments. Initial HRAs must be completed
          within 90 days of enrollment. Care plans must be reviewed at least quarterly. Hospital
          admissions and discharges require follow-up within 48 hours. All care management actions
          are logged in the audit trail.
        </p>
      </div>
    </div>
  );
}