import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import StatsCard from '../components/dashboard/StatsCard.jsx';
import RecentActivity from '../components/dashboard/RecentActivity.jsx';
import ComplianceOverview from '../components/dashboard/ComplianceOverview.jsx';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Alert from '../components/common/Alert.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { getItem } from '../utils/storage.js';
import { getEnrollmentStats } from '../services/enrollmentService.js';
import { getClaimStats } from '../services/claimsService.js';
import { getCareManagementStats } from '../services/careManagementService.js';
import { getProviderStats } from '../services/providerService.js';
import { getEligibilityStats } from '../services/eligibilityService.js';
import { getBenefitStats } from '../services/benefitsService.js';
import { getComplianceStats } from '../services/complianceService.js';
import {
  formatCurrency,
  formatRelativeTime,
  toTitleCase,
} from '../utils/helpers.js';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  ENROLLMENT_STATUSES,
  CLAIM_STATUSES,
} from '../utils/constants.js';
import { CONDITION_CATEGORY_LABELS } from '../data/icd10Data.js';

/**
 * Module status card data builder.
 * @param {string} label - Module label
 * @param {string} path - Navigation path
 * @param {string} iconPath - SVG icon path data
 * @param {string} value - Primary metric value
 * @param {string} description - Description text
 * @param {string} trend - Trend direction
 * @param {string} trendValue - Trend value text
 * @param {string} iconVariant - Icon color variant
 * @returns {Object}
 */
function buildModuleCard(label, path, iconPath, value, description, trend, trendValue, iconVariant) {
  return { label, path, iconPath, value, description, trend, trendValue, iconVariant };
}

/**
 * Quick action button definition.
 * @typedef {Object} QuickAction
 * @property {string} label - Button label
 * @property {string} path - Navigation path
 * @property {string} iconPath - SVG icon path data
 * @property {string} variant - Button variant
 * @property {string[]} roles - Roles that can see this action (empty = all)
 */

/**
 * Quick action definitions for common workflows.
 * @type {QuickAction[]}
 */
const QUICK_ACTIONS = [
  {
    label: 'New Enrollment',
    path: '/enrollment',
    iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    variant: 'primary',
    roles: [USER_ROLES.ADMIN, USER_ROLES.ENROLLMENT_SPECIALIST],
  },
  {
    label: 'Validate Eligibility',
    path: '/eligibility',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    variant: 'outline',
    roles: [USER_ROLES.ADMIN, USER_ROLES.ENROLLMENT_SPECIALIST, USER_ROLES.CARE_MANAGER],
  },
  {
    label: 'Submit Claim',
    path: '/claims',
    iconPath: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
    variant: 'outline',
    roles: [USER_ROLES.ADMIN, USER_ROLES.CLAIMS_PROCESSOR],
  },
  {
    label: 'Care Management',
    path: '/care-management',
    iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    variant: 'outline',
    roles: [USER_ROLES.ADMIN, USER_ROLES.CARE_MANAGER],
  },
  {
    label: 'Provider Network',
    path: '/providers',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    variant: 'outline',
    roles: [USER_ROLES.ADMIN, USER_ROLES.CARE_MANAGER, USER_ROLES.ENROLLMENT_SPECIALIST, USER_ROLES.PROVIDER],
  },
  {
    label: 'Run Compliance Audit',
    path: '/compliance',
    iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    variant: 'outline',
    roles: [USER_ROLES.ADMIN, USER_ROLES.AUDITOR],
  },
  {
    label: 'View Audit Logs',
    path: '/audit-logs',
    iconPath: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    variant: 'ghost',
    roles: [USER_ROLES.ADMIN, USER_ROLES.AUDITOR],
  },
  {
    label: 'Benefits Configuration',
    path: '/benefits',
    iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    variant: 'ghost',
    roles: [USER_ROLES.ADMIN, USER_ROLES.ENROLLMENT_SPECIALIST],
  },
];

/**
 * Skeleton loading state for the dashboard.
 * @returns {React.ReactElement}
 */
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl" />
        <div className="h-96 bg-gray-200 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Module status card component for the dashboard.
 *
 * @param {Object} props
 * @param {string} props.label - Module label
 * @param {string} props.value - Primary metric value
 * @param {string} props.description - Description text
 * @param {string} props.iconPath - SVG icon path data
 * @param {string} props.iconVariant - Icon color variant
 * @param {string} [props.trend] - Trend direction
 * @param {string} [props.trendValue] - Trend value text
 * @param {Function} props.onClick - Click handler
 * @returns {React.ReactElement}
 */
function ModuleStatusCard({ label, value, description, iconPath, iconVariant, trend, trendValue, onClick }) {
  return (
    <StatsCard
      label={label}
      value={value}
      trend={trend}
      trendValue={trendValue}
      description={description}
      iconVariant={iconVariant}
      hoverable={true}
      onClick={onClick}
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
          <path d={iconPath} />
        </svg>
      }
    />
  );
}

/**
 * Condition category distribution component.
 *
 * @param {Object} props
 * @param {Object.<string, number>} props.distribution - Map of condition categories to member counts
 * @param {number} props.totalMembers - Total number of members
 * @returns {React.ReactElement}
 */
function ConditionDistribution({ distribution, totalMembers }) {
  if (!distribution || typeof distribution !== 'object' || Object.keys(distribution).length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <p className="text-xs text-gray-400">No condition category data available.</p>
      </div>
    );
  }

  const sorted = Object.entries(distribution)
    .map(([category, count]) => ({
      category,
      label: CONDITION_CATEGORY_LABELS[category] || toTitleCase(category),
      count: typeof count === 'number' ? count : 0,
      percentage: totalMembers > 0 ? Math.round((count / totalMembers) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const colors = [
    'bg-csnp-primary',
    'bg-csnp-secondary',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-green-500',
    'bg-cyan-500',
  ];

  return (
    <div className="space-y-3">
      {sorted.slice(0, 8).map((item, index) => (
        <div key={item.category}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]" title={item.label}>
              {item.label}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-900">{item.count}</span>
              <span className="text-[10px] text-gray-400">({item.percentage}%)</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ease-out ${colors[index % colors.length]}`}
              style={{ width: `${Math.max(item.percentage, 2)}%` }}
              role="progressbar"
              aria-valuenow={item.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${item.label}: ${item.percentage}%`}
            />
          </div>
        </div>
      ))}
      {sorted.length > 8 && (
        <p className="text-[10px] text-gray-400 text-center">
          +{sorted.length - 8} more categor{sorted.length - 8 !== 1 ? 'ies' : 'y'}
        </p>
      )}
    </div>
  );
}

/**
 * Main dashboard page component.
 * Displays key metrics (total members, active enrollments, pending claims,
 * compliance score), recent activity feed, compliance overview widget,
 * quick action buttons for common workflows, and module status cards.
 *
 * @returns {React.ReactElement}
 */
export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  /**
   * Loads all dashboard data from various services.
   */
  const loadDashboardData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
      // Load members
      let members = [];
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const parsed = JSON.parse(storedMembers);
          if (Array.isArray(parsed)) {
            members = parsed;
          }
        }
      } catch {
        members = [];
      }

      // Load enrollment stats
      let enrollmentStats = { total: 0, byStatus: {}, byChannel: {}, byPlanType: {} };
      try {
        enrollmentStats = getEnrollmentStats();
      } catch {
        // Silently fail
      }

      // Load claim stats
      let claimStats = {
        total: 0, byStatus: {}, totalBilled: 0, totalPaid: 0,
        totalMemberResponsibility: 0, denialRate: 0, approvalRate: 0,
      };
      try {
        claimStats = getClaimStats();
      } catch {
        // Silently fail
      }

      // Load care management stats
      let careStats = {
        totalCareEvents: 0, totalCarePlans: 0, activeCarePlans: 0,
        totalAlerts: 0, activeAlerts: 0, totalTasks: 0, pendingTasks: 0,
        completedTasks: 0, totalHRAs: 0,
      };
      try {
        careStats = getCareManagementStats();
      } catch {
        // Silently fail
      }

      // Load provider stats
      let providerStats = {
        totalProviders: 0, inNetworkCount: 0, outOfNetworkCount: 0,
        acceptingNewPatientsCount: 0, totalAssignments: 0, activeAssignments: 0,
        totalReferrals: 0, pendingReferrals: 0,
      };
      try {
        providerStats = getProviderStats();
      } catch {
        // Silently fail
      }

      // Load eligibility stats
      let eligibilityStats = {
        totalValidations: 0, eligibleCount: 0, ineligibleCount: 0,
        pendingCount: 0, expiredCount: 0, byCategory: {},
      };
      try {
        eligibilityStats = getEligibilityStats();
      } catch {
        // Silently fail
      }

      // Load benefit stats
      let benefitStats = {
        totalPackages: 0, totalAssignments: 0, activeAssignments: 0,
      };
      try {
        benefitStats = getBenefitStats();
      } catch {
        // Silently fail
      }

      // Load compliance stats
      let complianceStats = {
        totalReports: 0, totalAudits: 0, totalExtracts: 0,
        overallStatus: 'compliant', lastAuditDate: null,
      };
      try {
        complianceStats = getComplianceStats();
      } catch {
        // Silently fail
      }

      // Build condition category distribution from members
      const conditionDistribution = {};
      for (const member of members) {
        if (member.conditionCategory) {
          if (!conditionDistribution[member.conditionCategory]) {
            conditionDistribution[member.conditionCategory] = 0;
          }
          conditionDistribution[member.conditionCategory]++;
        }
      }

      // Calculate key metrics
      const totalMembers = members.length;
      const csnpEligibleMembers = members.filter((m) => m.csnpEligible).length;
      const activeEnrollments = enrollmentStats.byStatus
        ? (enrollmentStats.byStatus[ENROLLMENT_STATUSES.ACTIVE] || 0)
        : 0;
      const pendingEnrollments = enrollmentStats.byStatus
        ? (enrollmentStats.byStatus[ENROLLMENT_STATUSES.PENDING] || 0)
        : 0;
      const pendingClaims = claimStats.byStatus
        ? ((claimStats.byStatus[CLAIM_STATUSES.SUBMITTED] || 0) +
           (claimStats.byStatus[CLAIM_STATUSES.PENDING] || 0) +
           (claimStats.byStatus[CLAIM_STATUSES.IN_REVIEW] || 0))
        : 0;
      const deniedClaims = claimStats.byStatus
        ? (claimStats.byStatus[CLAIM_STATUSES.DENIED] || 0)
        : 0;
      const paidClaims = claimStats.byStatus
        ? (claimStats.byStatus[CLAIM_STATUSES.PAID] || 0)
        : 0;

      setDashboardData({
        members,
        totalMembers,
        csnpEligibleMembers,
        activeEnrollments,
        pendingEnrollments,
        pendingClaims,
        deniedClaims,
        paidClaims,
        conditionDistribution,
        enrollmentStats,
        claimStats,
        careStats,
        providerStats,
        eligibilityStats,
        benefitStats,
        complianceStats,
      });
    } catch (err) {
      console.error('DashboardPage: failed to load dashboard data:', err);
      setError('Unable to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  /**
   * Computed: visible quick actions based on user role.
   */
  const visibleQuickActions = useMemo(() => {
    if (!user) {
      return [];
    }

    return QUICK_ACTIONS.filter((action) => {
      if (action.roles.length === 0) {
        return true;
      }
      return action.roles.includes(user.role);
    });
  }, [user]);

  /**
   * Computed: greeting message based on time of day.
   */
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }, []);

  /**
   * Computed: user display name.
   */
  const userDisplayName = useMemo(() => {
    if (!user) {
      return '';
    }
    return user.firstName || user.username || '';
  }, [user]);

  /**
   * Computed: user role label.
   */
  const userRoleLabel = useMemo(() => {
    if (!user) {
      return '';
    }
    return USER_ROLE_LABELS[user.role] || toTitleCase(user.role || '');
  }, [user]);

  /**
   * Handles navigation to a module page.
   * @param {string} path - The path to navigate to
   */
  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
            {greeting}, {userDisplayName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {userRoleLabel} · CSNP Portal Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
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

      {/* Loading State */}
      {loading && !dashboardData && (
        <DashboardSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load dashboard"
          description={error}
          iconType="error"
          size="md"
          actionLabel="Retry"
          onAction={loadDashboardData}
          actionVariant="outline"
        />
      )}

      {/* Dashboard Content */}
      {dashboardData && (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Members */}
            <StatsCard
              label="Total Members"
              value={String(dashboardData.totalMembers)}
              trend={dashboardData.totalMembers > 0 ? 'up' : 'neutral'}
              trendValue={dashboardData.csnpEligibleMembers > 0 ? `${dashboardData.csnpEligibleMembers} CSNP eligible` : ''}
              description={`${dashboardData.csnpEligibleMembers} CSNP eligible`}
              iconVariant="primary"
              hoverable={true}
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
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />

            {/* Active Enrollments */}
            <StatsCard
              label="Active Enrollments"
              value={String(dashboardData.activeEnrollments)}
              trend={dashboardData.pendingEnrollments > 0 ? 'up' : 'neutral'}
              trendValue={dashboardData.pendingEnrollments > 0 ? `${dashboardData.pendingEnrollments} pending` : ''}
              description={`${dashboardData.pendingEnrollments} pending review`}
              iconVariant="success"
              hoverable={true}
              onClick={() => handleNavigate('/enrollment')}
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
                  <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
            />

            {/* Pending Claims */}
            <StatsCard
              label="Pending Claims"
              value={String(dashboardData.pendingClaims)}
              trend={dashboardData.deniedClaims > 0 ? 'down' : 'neutral'}
              trendValue={dashboardData.deniedClaims > 0 ? `${dashboardData.deniedClaims} denied` : ''}
              description={`${formatCurrency(dashboardData.claimStats.totalPaid)} total paid`}
              iconVariant="warning"
              hoverable={true}
              onClick={() => handleNavigate('/claims')}
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
                  <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                </svg>
              }
            />

            {/* Compliance Score */}
            <StatsCard
              label="Compliance Status"
              value={toTitleCase(dashboardData.complianceStats.overallStatus || 'compliant')}
              trend={dashboardData.complianceStats.overallStatus === 'compliant' ? 'up' : dashboardData.complianceStats.overallStatus === 'non_compliant' ? 'down' : 'neutral'}
              trendValue={dashboardData.complianceStats.totalAudits > 0 ? `${dashboardData.complianceStats.totalAudits} audits` : ''}
              description={dashboardData.complianceStats.lastAuditDate ? `Last audit: ${formatRelativeTime(dashboardData.complianceStats.lastAuditDate)}` : 'No audits performed'}
              iconVariant={dashboardData.complianceStats.overallStatus === 'compliant' ? 'success' : dashboardData.complianceStats.overallStatus === 'non_compliant' ? 'error' : 'warning'}
              hoverable={true}
              onClick={() => handleNavigate('/compliance')}
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
            />
          </div>

          {/* Alerts Row */}
          {dashboardData.careStats.activeAlerts > 0 && (
            <Alert
              variant="warning"
              title={`${dashboardData.careStats.activeAlerts} Active Care Alert${dashboardData.careStats.activeAlerts !== 1 ? 's' : ''}`}
              showIcon={true}
              bordered={true}
              size="sm"
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigate('/care-management')}
                >
                  View Alerts
                </Button>
              }
            >
              {dashboardData.careStats.pendingTasks > 0
                ? `${dashboardData.careStats.pendingTasks} pending task${dashboardData.careStats.pendingTasks !== 1 ? 's' : ''} also require attention.`
                : 'Review and acknowledge active care management alerts.'}
            </Alert>
          )}

          {dashboardData.pendingClaims > 5 && (
            <Alert
              variant="info"
              title={`${dashboardData.pendingClaims} Claims Awaiting Processing`}
              showIcon={true}
              bordered={true}
              size="sm"
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigate('/claims')}
                >
                  Process Claims
                </Button>
              }
            >
              Claims pending processing may impact timely filing compliance. Review and process pending claims.
            </Alert>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity Feed - Takes 2 columns */}
            <div className="lg:col-span-2">
              <RecentActivity
                maxEntries={12}
                showModule={true}
                showHeader={true}
                title="Recent Activity"
                refreshInterval={0}
              />
            </div>

            {/* Compliance Overview - Takes 1 column */}
            <div>
              <ComplianceOverview
                showHeader={true}
                title="Compliance Overview"
                showModuleBreakdown={true}
                showAuditButton={true}
                compact={false}
                refreshInterval={0}
              />
            </div>
          </div>

          {/* Quick Actions */}
          {visibleQuickActions.length > 0 && (
            <Card
              bordered={true}
              flat={false}
              size="md"
              title="Quick Actions"
              subtitle="Common workflows and shortcuts"
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
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              }
            >
              <div className="flex flex-wrap gap-2">
                {visibleQuickActions.map((action) => (
                  <Button
                    key={action.path}
                    variant={action.variant}
                    size="sm"
                    onClick={() => handleNavigate(action.path)}
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
                        <path d={action.iconPath} />
                      </svg>
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Module Status Cards */}
          <div>
            <h2 className="text-lg font-semibold text-csnp-primary mb-4">Module Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Eligibility */}
              <ModuleStatusCard
                label="Eligibility Validations"
                value={String(dashboardData.eligibilityStats.totalValidations)}
                description={`${dashboardData.eligibilityStats.eligibleCount} eligible, ${dashboardData.eligibilityStats.ineligibleCount} ineligible`}
                iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                iconVariant="primary"
                trend={dashboardData.eligibilityStats.eligibleCount > 0 ? 'up' : 'neutral'}
                trendValue={dashboardData.eligibilityStats.eligibleCount > 0 ? `${dashboardData.eligibilityStats.eligibleCount} eligible` : ''}
                onClick={() => handleNavigate('/eligibility')}
              />

              {/* Care Management */}
              <ModuleStatusCard
                label="Care Events"
                value={String(dashboardData.careStats.totalCareEvents)}
                description={`${dashboardData.careStats.activeCarePlans} active care plans`}
                iconPath="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                iconVariant="error"
                trend={dashboardData.careStats.activeAlerts > 0 ? 'down' : 'up'}
                trendValue={dashboardData.careStats.activeAlerts > 0 ? `${dashboardData.careStats.activeAlerts} alerts` : 'No alerts'}
                onClick={() => handleNavigate('/care-management')}
              />

              {/* Providers */}
              <ModuleStatusCard
                label="Provider Network"
                value={String(dashboardData.providerStats.totalProviders)}
                description={`${dashboardData.providerStats.inNetworkCount} in-network`}
                iconPath="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                iconVariant="secondary"
                trend={dashboardData.providerStats.acceptingNewPatientsCount > 0 ? 'up' : 'neutral'}
                trendValue={`${dashboardData.providerStats.acceptingNewPatientsCount} accepting`}
                onClick={() => handleNavigate('/providers')}
              />

              {/* Benefits */}
              <ModuleStatusCard
                label="Benefit Packages"
                value={String(dashboardData.benefitStats.totalPackages)}
                description={`${dashboardData.benefitStats.activeAssignments} active assignments`}
                iconPath="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                iconVariant="info"
                trend="neutral"
                trendValue={`${dashboardData.benefitStats.totalAssignments} total`}
                onClick={() => handleNavigate('/benefits')}
              />
            </div>
          </div>

          {/* Financial Summary & Condition Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Financial Summary */}
            <Card
              bordered={true}
              flat={false}
              size="md"
              title="Claims Financial Summary"
              subtitle="Overview of claims financial activity"
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
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
                    <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Billed</p>
                    <p className="text-sm font-bold text-csnp-primary mt-0.5">
                      {formatCurrency(dashboardData.claimStats.totalBilled)}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Total Paid</p>
                    <p className="text-sm font-bold text-green-700 mt-0.5">
                      {formatCurrency(dashboardData.claimStats.totalPaid)}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Member Resp.</p>
                    <p className="text-sm font-bold text-yellow-700 mt-0.5">
                      {formatCurrency(dashboardData.claimStats.totalMemberResponsibility)}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Denial Rate</p>
                    <p className="text-sm font-bold text-red-700 mt-0.5">
                      {dashboardData.claimStats.denialRate || 0}%
                    </p>
                  </div>
                </div>

                {/* Claims Status Breakdown */}
                <div className="flex items-center gap-3 flex-wrap">
                  {dashboardData.paidClaims > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                      <span className="text-[10px] font-medium text-green-700">
                        {dashboardData.paidClaims} paid
                      </span>
                    </div>
                  )}
                  {dashboardData.pendingClaims > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                      <span className="text-[10px] font-medium text-yellow-700">
                        {dashboardData.pendingClaims} processing
                      </span>
                    </div>
                  )}
                  {dashboardData.deniedClaims > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                      <span className="text-[10px] font-medium text-red-700">
                        {dashboardData.deniedClaims} denied
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-csnp-primary">
                      {dashboardData.claimStats.total} total
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavigate('/claims')}
                    iconRight={
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
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    }
                  >
                    View All Claims
                  </Button>
                </div>
              </div>
            </Card>

            {/* Condition Category Distribution */}
            <Card
              bordered={true}
              flat={false}
              size="md"
              title="Condition Category Distribution"
              subtitle={`${dashboardData.totalMembers} total members`}
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
            >
              <ConditionDistribution
                distribution={dashboardData.conditionDistribution}
                totalMembers={dashboardData.totalMembers}
              />
            </Card>
          </div>

          {/* Care Management Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <svg
                    width="16"
                    height="16"
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
                </div>
                <p className="text-xs font-semibold text-blue-800">Active Care Plans</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">{dashboardData.careStats.activeCarePlans}</p>
              <p className="text-[10px] text-blue-500 mt-1">
                {dashboardData.careStats.totalHRAs} HRAs completed
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
                  <svg
                    width="16"
                    height="16"
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
                </div>
                <p className="text-xs font-semibold text-yellow-800">Pending Tasks</p>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{dashboardData.careStats.pendingTasks}</p>
              <p className="text-[10px] text-yellow-500 mt-1">
                {dashboardData.careStats.completedTasks} completed
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                  <svg
                    width="16"
                    height="16"
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
                </div>
                <p className="text-xs font-semibold text-purple-800">Pending Referrals</p>
              </div>
              <p className="text-2xl font-bold text-purple-700">{dashboardData.providerStats.pendingReferrals}</p>
              <p className="text-[10px] text-purple-500 mt-1">
                {dashboardData.providerStats.totalReferrals} total referrals
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-2xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                  <svg
                    width="16"
                    height="16"
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
                </div>
                <p className="text-xs font-semibold text-green-800">CMS Reports</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{dashboardData.complianceStats.totalReports}</p>
              <p className="text-[10px] text-green-500 mt-1">
                {dashboardData.complianceStats.totalExtracts} extracts generated
              </p>
            </div>
          </div>

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
              This dashboard provides an overview of your Chronic Condition Special Needs Plan (C-SNP) operations.
              All data is managed in compliance with CMS regulations (42 CFR §422.4) and HIPAA security requirements
              (45 CFR §164.312). Regular compliance audits and member re-verifications are required to maintain
              regulatory adherence. All actions are logged in the audit trail.
            </p>
          </div>
        </>
      )}
    </div>
  );
}