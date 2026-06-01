import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Button from '../common/Button.jsx';
import { getComplianceStatus, getComplianceStats, runWeeklyAudit } from '../../services/complianceService.js';
import { checkAnnualReverification } from '../../services/eligibilityService.js';
import { formatRelativeTime, formatDate } from '../../utils/helpers.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Compliance level to color mapping for the gauge and badges.
 * @type {Object.<string, { color: string, bgColor: string, textColor: string, label: string, score: number }>}
 */
const COMPLIANCE_LEVEL_STYLES = {
  compliant: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    gaugeColor: '#27ae60',
    label: 'Compliant',
    score: 100,
  },
  minor_issues: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-200',
    gaugeColor: '#f39c12',
    label: 'Minor Issues',
    score: 75,
  },
  major_issues: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-200',
    gaugeColor: '#e67e22',
    label: 'Major Issues',
    score: 50,
  },
  non_compliant: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    gaugeColor: '#e74c3c',
    label: 'Non-Compliant',
    score: 25,
  },
};

/**
 * Default compliance level style for unknown statuses.
 * @type {Object}
 */
const DEFAULT_LEVEL_STYLE = {
  color: 'text-gray-500',
  bgColor: 'bg-gray-50',
  textColor: 'text-gray-700',
  borderColor: 'border-gray-200',
  gaugeColor: '#9ca3af',
  label: 'Unknown',
  score: 0,
};

/**
 * Module label mapping for display.
 * @type {Object.<string, string>}
 */
const MODULE_LABELS = {
  enrollment: 'Enrollment',
  claims: 'Claims',
  eligibility: 'Eligibility',
  benefits: 'Benefits',
  providers: 'Providers',
  care_management: 'Care Management',
  audit_trail: 'Audit Trail',
};

/**
 * Returns the compliance level style for a given level string.
 * @param {string} level - The compliance level
 * @returns {Object} The style object
 */
function getLevelStyle(level) {
  if (typeof level !== 'string' || level.trim().length === 0) {
    return DEFAULT_LEVEL_STYLE;
  }
  return COMPLIANCE_LEVEL_STYLES[level.trim()] || DEFAULT_LEVEL_STYLE;
}

/**
 * Compliance score gauge SVG component.
 *
 * @param {Object} props
 * @param {number} props.score - Score value (0-100)
 * @param {string} props.color - Gauge color hex string
 * @param {string} props.label - Label text below the score
 * @returns {React.ReactElement}
 */
function ComplianceGauge({ score, color, label }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg
          className="w-24 h-24 -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{safeScore}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

ComplianceGauge.propTypes = {
  score: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
};

/**
 * Module compliance status row component.
 *
 * @param {Object} props
 * @param {string} props.moduleName - Module display name
 * @param {Object} props.status - Module status object
 * @returns {React.ReactElement}
 */
function ModuleStatusRow({ moduleName, status }) {
  const level = status && typeof status.complianceLevel === 'string'
    ? status.complianceLevel
    : 'compliant';
  const violations = status && typeof status.violations === 'number' ? status.violations : 0;
  const warnings = status && typeof status.warnings === 'number' ? status.warnings : 0;

  const statusMap = {
    compliant: 'compliant',
    minor_issues: 'minor_issues',
    major_issues: 'major_issues',
    non_compliant: 'non_compliant',
  };

  const badgeStatus = statusMap[level] || 'pending';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs font-medium text-gray-700 truncate">
          {moduleName}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {violations > 0 && (
          <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
            {violations} violation{violations !== 1 ? 's' : ''}
          </span>
        )}
        {warnings > 0 && (
          <span className="text-[10px] font-medium text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">
            {warnings} warning{warnings !== 1 ? 's' : ''}
          </span>
        )}
        <StatusBadge
          status={badgeStatus}
          size="sm"
          showDot={true}
          bordered={false}
        />
      </div>
    </div>
  );
}

ModuleStatusRow.propTypes = {
  moduleName: PropTypes.string.isRequired,
  status: PropTypes.shape({
    complianceLevel: PropTypes.string,
    violations: PropTypes.number,
    warnings: PropTypes.number,
    recommendations: PropTypes.number,
  }),
};

ModuleStatusRow.defaultProps = {
  status: null,
};

/**
 * Skeleton loading state for the compliance overview.
 * @returns {React.ReactElement}
 */
function ComplianceOverviewSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 bg-gray-200 rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="space-y-2 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dashboard compliance overview widget showing CMS compliance status,
 * upcoming audit dates, re-verification counts, and compliance score gauge.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Compliance Overview'] - Section title
 * @param {boolean} [props.showModuleBreakdown=true] - Whether to show per-module breakdown
 * @param {boolean} [props.showAuditButton=true] - Whether to show the run audit button
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ComplianceOverview({
  showHeader = true,
  title = 'Compliance Overview',
  showModuleBreakdown = true,
  showAuditButton = true,
  compact = false,
  refreshInterval = 0,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [complianceStatus, setComplianceStatus] = useState(null);
  const [complianceStats, setComplianceStats] = useState(null);
  const [reverificationCount, setReverificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Loads compliance data from the compliance service.
   */
  const loadComplianceData = useCallback(() => {
    setError(null);

    try {
      const statusResult = getComplianceStatus();
      if (statusResult && statusResult.success) {
        setComplianceStatus(statusResult);
      } else {
        setComplianceStatus({
          overallStatus: 'compliant',
          moduleStatuses: {},
          recentAudits: [],
          openFindings: [],
          lastAuditDate: null,
        });
      }

      const stats = getComplianceStats();
      setComplianceStats(stats);

      // Count members needing re-verification
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const members = JSON.parse(storedMembers);
          if (Array.isArray(members)) {
            let reVerCount = 0;
            for (const member of members) {
              if (member && member.id) {
                const reverification = checkAnnualReverification(member.id);
                if (reverification && reverification.required) {
                  reVerCount++;
                }
              }
            }
            setReverificationCount(reVerCount);
          }
        }
      } catch {
        // Silently fail — re-verification count will remain 0
      }
    } catch (err) {
      console.error('ComplianceOverview: failed to load compliance data:', err);
      setError('Unable to load compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadComplianceData();
  }, [loadComplianceData]);

  /**
   * Auto-refresh interval.
   */
  useEffect(() => {
    if (typeof refreshInterval !== 'number' || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      loadComplianceData();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval, loadComplianceData]);

  /**
   * Handles running a weekly compliance audit.
   */
  const handleRunAudit = useCallback(() => {
    setAuditRunning(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = runWeeklyAudit({ performedBy });

      if (result && result.success) {
        addNotification(
          'success',
          'Compliance Audit Complete',
          `Audit completed. Status: ${result.complianceLevel || 'unknown'}. ${result.summary ? result.summary.totalViolations : 0} violation(s) found.`
        );
        loadComplianceData();
      } else {
        addNotification(
          'error',
          'Audit Failed',
          result && result.error ? result.error : 'An error occurred while running the compliance audit.'
        );
      }
    } catch (err) {
      console.error('ComplianceOverview: failed to run audit:', err);
      addNotification(
        'error',
        'Audit Failed',
        'An unexpected error occurred while running the compliance audit.'
      );
    } finally {
      setAuditRunning(false);
    }
  }, [user, addNotification, loadComplianceData]);

  /**
   * Computed compliance level and style.
   */
  const overallLevel = useMemo(() => {
    if (!complianceStatus) {
      return 'compliant';
    }
    return complianceStatus.overallStatus || 'compliant';
  }, [complianceStatus]);

  const levelStyle = useMemo(() => {
    return getLevelStyle(overallLevel);
  }, [overallLevel]);

  /**
   * Computed module statuses for display.
   */
  const moduleStatusEntries = useMemo(() => {
    if (!complianceStatus || !complianceStatus.moduleStatuses || typeof complianceStatus.moduleStatuses !== 'object') {
      return [];
    }

    return Object.entries(complianceStatus.moduleStatuses).map(([key, value]) => ({
      key,
      label: MODULE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      status: value,
    }));
  }, [complianceStatus]);

  /**
   * Computed stats summary.
   */
  const statsSummary = useMemo(() => {
    return {
      totalReports: complianceStats ? complianceStats.totalReports : 0,
      totalAudits: complianceStats ? complianceStats.totalAudits : 0,
      totalExtracts: complianceStats ? complianceStats.totalExtracts : 0,
      lastAuditDate: complianceStatus ? complianceStatus.lastAuditDate : null,
      openFindings: complianceStatus && Array.isArray(complianceStatus.openFindings)
        ? complianceStatus.openFindings.length
        : 0,
    };
  }, [complianceStats, complianceStatus]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [
    'bg-white rounded-2xl shadow-card border border-gray-200',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {/* Compliance icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            {hasTitle && (
              <h3 className="text-sm font-semibold text-csnp-primary">
                {title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showAuditButton && isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAudit}
                loading={auditRunning}
                loadingText="Running..."
                disabled={auditRunning}
              >
                Run Audit
              </Button>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={compact ? 'px-4 py-3' : 'px-5 py-4'}>
        {/* Loading State */}
        {loading && (
          <ComplianceOverviewSkeleton />
        )}

        {/* Error State */}
        {!loading && error && (
          <EmptyState
            title="Unable to load compliance data"
            description={error}
            iconType="error"
            size="sm"
            actionLabel="Retry"
            onAction={loadComplianceData}
            actionVariant="outline"
          />
        )}

        {/* Compliance Data */}
        {!loading && !error && (
          <>
            {/* Top Section: Gauge + Summary Stats */}
            <div className="flex items-start gap-5">
              {/* Gauge */}
              <ComplianceGauge
                score={levelStyle.score}
                color={levelStyle.gaugeColor}
                label={levelStyle.label}
              />

              {/* Summary Stats */}
              <div className="flex-1 min-w-0">
                {/* Overall Status Badge */}
                <div className="mb-3">
                  <StatusBadge
                    status={overallLevel}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Open Findings</p>
                    <p className={`text-sm font-semibold ${statsSummary.openFindings > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                      {statsSummary.openFindings}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Re-Verifications</p>
                    <p className={`text-sm font-semibold ${reverificationCount > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {reverificationCount} due
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Audits</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {statsSummary.totalAudits}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Last Audit</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {statsSummary.lastAuditDate
                        ? formatRelativeTime(statsSummary.lastAuditDate)
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Module Breakdown */}
            {showModuleBreakdown && moduleStatusEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Module Status
                </p>
                <div className="divide-y divide-gray-50">
                  {moduleStatusEntries.map((entry) => (
                    <ModuleStatusRow
                      key={entry.key}
                      moduleName={entry.label}
                      status={entry.status}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Audits */}
            {!compact && complianceStatus && Array.isArray(complianceStatus.recentAudits) && complianceStatus.recentAudits.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Recent Audits
                </p>
                <div className="space-y-2">
                  {complianceStatus.recentAudits.slice(0, 3).map((audit, index) => {
                    const auditLevelStyle = getLevelStyle(audit.complianceLevel);
                    return (
                      <div
                        key={audit.id || `audit-${index}`}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              audit.complianceLevel === 'compliant'
                                ? 'bg-green-500'
                                : audit.complianceLevel === 'minor_issues'
                                  ? 'bg-yellow-500'
                                  : audit.complianceLevel === 'major_issues'
                                    ? 'bg-orange-500'
                                    : 'bg-red-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-xs text-gray-600 truncate">
                            {audit.performedAt
                              ? formatDate(audit.performedAt)
                              : 'Unknown date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {typeof audit.totalViolations === 'number' && audit.totalViolations > 0 && (
                            <span className="text-[10px] text-red-500 font-medium">
                              {audit.totalViolations}V
                            </span>
                          )}
                          {typeof audit.totalWarnings === 'number' && audit.totalWarnings > 0 && (
                            <span className="text-[10px] text-yellow-500 font-medium">
                              {audit.totalWarnings}W
                            </span>
                          )}
                          <span className={`text-[10px] font-medium ${auditLevelStyle.color}`}>
                            {auditLevelStyle.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CMS Compliance Notice */}
            {!compact && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-start gap-2 p-2 bg-csnp-blue-50 rounded-lg">
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
                    CMS requires weekly C-SNP compliance audits and annual member re-verification.
                    Run audits regularly to maintain compliance status.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && statsSummary.totalReports > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            {statsSummary.totalReports} report{statsSummary.totalReports !== 1 ? 's' : ''} generated
            {' · '}
            {statsSummary.totalExtracts} extract{statsSummary.totalExtracts !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

ComplianceOverview.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showModuleBreakdown: PropTypes.bool,
  showAuditButton: PropTypes.bool,
  compact: PropTypes.bool,
  refreshInterval: PropTypes.number,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ComplianceOverview.defaultProps = {
  showHeader: true,
  title: 'Compliance Overview',
  showModuleBreakdown: true,
  showAuditButton: true,
  compact: false,
  refreshInterval: 0,
  className: '',
  headerActions: null,
};