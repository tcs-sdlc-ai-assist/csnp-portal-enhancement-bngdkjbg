import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  getComplianceStatus,
  getComplianceStats,
  getComplianceAudits,
  runWeeklyAudit,
  validateCMSCompliance,
  COMPLIANCE_MODULES,
  COMPLIANCE_LEVELS,
} from '../../services/complianceService.js';
import { checkAnnualReverification } from '../../services/eligibilityService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
} from '../../utils/helpers.js';

/**
 * Compliance level to style mapping.
 * @type {Object.<string, { color: string, bgColor: string, textColor: string, borderColor: string, gaugeColor: string, label: string, score: number }>}
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
 * Default compliance level style.
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
 * Module icon paths.
 * @type {Object.<string, string>}
 */
const MODULE_ICONS = {
  enrollment: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  claims: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  eligibility: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  benefits: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  providers: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  care_management: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  audit_trail: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
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
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Gauge size
 * @returns {React.ReactElement}
 */
function ComplianceGauge({ score, color, label, size = 'md' }) {
  const sizeConfig = {
    sm: { container: 'w-20 h-20', radius: 32, strokeWidth: 6, fontSize: 'text-lg' },
    md: { container: 'w-28 h-28', radius: 40, strokeWidth: 8, fontSize: 'text-2xl' },
    lg: { container: 'w-36 h-36', radius: 50, strokeWidth: 10, fontSize: 'text-3xl' },
  };

  const config = sizeConfig[size] || sizeConfig.md;
  const circumference = 2 * Math.PI * config.radius;
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${config.container}`}>
        <svg
          className={`${config.container} -rotate-90`}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${config.fontSize} font-bold text-gray-900`}>{safeScore}</span>
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
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

ComplianceGauge.defaultProps = {
  size: 'md',
};

/**
 * Module compliance status card component.
 *
 * @param {Object} props
 * @param {string} props.moduleName - Module display name
 * @param {string} props.moduleKey - Module key
 * @param {Object} props.status - Module status object
 * @param {Function} props.onValidate - Validate handler
 * @param {boolean} [props.validating=false] - Whether validation is in progress
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function ModuleComplianceCard({ moduleName, moduleKey, status, onValidate, validating = false, disabled = false }) {
  const level = status && typeof status.complianceLevel === 'string'
    ? status.complianceLevel
    : 'compliant';
  const violations = status && typeof status.violations === 'number' ? status.violations : 0;
  const warnings = status && typeof status.warnings === 'number' ? status.warnings : 0;
  const recommendations = status && typeof status.recommendations === 'number' ? status.recommendations : 0;

  const levelStyle = getLevelStyle(level);
  const iconPath = MODULE_ICONS[moduleKey] || MODULE_ICONS.audit_trail;

  const statusMap = {
    compliant: 'compliant',
    minor_issues: 'minor_issues',
    major_issues: 'major_issues',
    non_compliant: 'non_compliant',
  };

  const badgeStatus = statusMap[level] || 'pending';

  return (
    <div className={`p-4 rounded-lg border transition-colors duration-150 ${levelStyle.bgColor} ${levelStyle.borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${levelStyle.bgColor} ${levelStyle.color}`}>
            <svg
              width="18"
              height="18"
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
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{moduleName}</p>
              <StatusBadge
                status={badgeStatus}
                label={levelStyle.label}
                size="sm"
                showDot={true}
                bordered={false}
              />
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
              {violations > 0 && (
                <span className="font-medium text-red-600">
                  {violations} violation{violations !== 1 ? 's' : ''}
                </span>
              )}
              {warnings > 0 && (
                <span className="font-medium text-yellow-600">
                  {warnings} warning{warnings !== 1 ? 's' : ''}
                </span>
              )}
              {recommendations > 0 && (
                <span className="font-medium text-blue-600">
                  {recommendations} recommendation{recommendations !== 1 ? 's' : ''}
                </span>
              )}
              {violations === 0 && warnings === 0 && recommendations === 0 && (
                <span className="text-green-600">No issues found</span>
              )}
            </div>
          </div>
        </div>

        {!disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onValidate(moduleKey)}
            disabled={validating}
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
            Validate
          </Button>
        )}
      </div>
    </div>
  );
}

ModuleComplianceCard.propTypes = {
  moduleName: PropTypes.string.isRequired,
  moduleKey: PropTypes.string.isRequired,
  status: PropTypes.shape({
    complianceLevel: PropTypes.string,
    violations: PropTypes.number,
    warnings: PropTypes.number,
    recommendations: PropTypes.number,
  }),
  onValidate: PropTypes.func.isRequired,
  validating: PropTypes.bool,
  disabled: PropTypes.bool,
};

ModuleComplianceCard.defaultProps = {
  status: null,
  validating: false,
  disabled: false,
};

/**
 * Audit history item component.
 *
 * @param {Object} props
 * @param {Object} props.audit - The audit record
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AuditHistoryItem({ audit, isLast = false }) {
  const levelStyle = getLevelStyle(audit.complianceLevel);

  return (
    <div className={`flex items-start gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${levelStyle.bgColor} ${levelStyle.color}`}>
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
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-900">
              {audit.auditType ? toTitleCase(audit.auditType) : 'Compliance'} Audit
            </span>
            <StatusBadge
              status={audit.complianceLevel === 'compliant' ? 'compliant' : audit.complianceLevel === 'minor_issues' ? 'minor_issues' : audit.complianceLevel === 'major_issues' ? 'major_issues' : 'non_compliant'}
              label={levelStyle.label}
              size="sm"
              showDot={true}
              bordered={false}
            />
          </div>
          <span
            className="text-[10px] text-gray-400 flex-shrink-0 ml-2"
            title={formatDateTime(audit.performedAt || audit.createdAt)}
          >
            {formatRelativeTime(audit.performedAt || audit.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
          {audit.summary && (
            <>
              {typeof audit.summary.totalViolations === 'number' && audit.summary.totalViolations > 0 && (
                <span className="text-red-500 font-medium">{audit.summary.totalViolations} violation{audit.summary.totalViolations !== 1 ? 's' : ''}</span>
              )}
              {typeof audit.summary.totalWarnings === 'number' && audit.summary.totalWarnings > 0 && (
                <span className="text-yellow-500 font-medium">{audit.summary.totalWarnings} warning{audit.summary.totalWarnings !== 1 ? 's' : ''}</span>
              )}
              {typeof audit.summary.totalRecommendations === 'number' && audit.summary.totalRecommendations > 0 && (
                <span className="text-blue-500 font-medium">{audit.summary.totalRecommendations} recommendation{audit.summary.totalRecommendations !== 1 ? 's' : ''}</span>
              )}
            </>
          )}
          {typeof audit.totalViolations === 'number' && audit.totalViolations > 0 && !audit.summary && (
            <span className="text-red-500 font-medium">{audit.totalViolations} violation{audit.totalViolations !== 1 ? 's' : ''}</span>
          )}
          {typeof audit.totalWarnings === 'number' && audit.totalWarnings > 0 && !audit.summary && (
            <span className="text-yellow-500 font-medium">{audit.totalWarnings} warning{audit.totalWarnings !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

AuditHistoryItem.propTypes = {
  audit: PropTypes.shape({
    id: PropTypes.string,
    auditType: PropTypes.string,
    complianceLevel: PropTypes.string,
    performedAt: PropTypes.string,
    createdAt: PropTypes.string,
    totalViolations: PropTypes.number,
    totalWarnings: PropTypes.number,
    summary: PropTypes.shape({
      totalViolations: PropTypes.number,
      totalWarnings: PropTypes.number,
      totalRecommendations: PropTypes.number,
    }),
  }).isRequired,
  isLast: PropTypes.bool,
};

AuditHistoryItem.defaultProps = {
  isLast: false,
};

/**
 * Compliance trend indicator component.
 *
 * @param {Object} props
 * @param {Object[]} props.audits - Array of recent audit records
 * @returns {React.ReactElement}
 */
function ComplianceTrendIndicator({ audits }) {
  if (!Array.isArray(audits) || audits.length < 2) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
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
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Insufficient data for trend</span>
      </div>
    );
  }

  const scoreMap = {
    compliant: 100,
    minor_issues: 75,
    major_issues: 50,
    non_compliant: 25,
  };

  const latestScore = scoreMap[audits[0].complianceLevel] || 0;
  const previousScore = scoreMap[audits[1].complianceLevel] || 0;
  const diff = latestScore - previousScore;

  if (diff > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
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
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        <span>Improving (+{diff})</span>
      </div>
    );
  }

  if (diff < 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
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
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
        <span>Declining ({diff})</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
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
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>Stable</span>
    </div>
  );
}

ComplianceTrendIndicator.propTypes = {
  audits: PropTypes.arrayOf(PropTypes.object),
};

ComplianceTrendIndicator.defaultProps = {
  audits: [],
};

/**
 * Re-verification statistics component.
 *
 * @param {Object} props
 * @param {number} props.totalMembers - Total number of members
 * @param {number} props.overdueCount - Number of overdue re-verifications
 * @param {number} props.dueSoonCount - Number of re-verifications due soon
 * @param {number} props.upcomingCount - Number of upcoming re-verifications
 * @param {number} props.notRequiredCount - Number not requiring re-verification
 * @returns {React.ReactElement}
 */
function ReverificationStats({ totalMembers, overdueCount, dueSoonCount, upcomingCount, notRequiredCount }) {
  const requiredCount = overdueCount + dueSoonCount + upcomingCount;
  const completionRate = totalMembers > 0
    ? Math.round(((totalMembers - requiredCount) / totalMembers) * 10000) / 100
    : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Re-Verification Status
        </p>
        <span className="text-[10px] font-medium text-gray-400">
          {completionRate}% compliant
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ease-out ${
            completionRate >= 90 ? 'bg-green-500' : completionRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${completionRate}%` }}
          role="progressbar"
          aria-valuenow={completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Re-verification compliance: ${completionRate}%`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2 bg-red-50 rounded-lg border border-red-200">
          <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Overdue</p>
          <p className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-red-400'}`}>
            {overdueCount}
          </p>
        </div>
        <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Due Soon</p>
          <p className={`text-lg font-bold ${dueSoonCount > 0 ? 'text-yellow-700' : 'text-yellow-400'}`}>
            {dueSoonCount}
          </p>
        </div>
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Upcoming</p>
          <p className="text-lg font-bold text-blue-700">
            {upcomingCount}
          </p>
        </div>
        <div className="p-2 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Compliant</p>
          <p className="text-lg font-bold text-green-700">
            {notRequiredCount}
          </p>
        </div>
      </div>
    </div>
  );
}

ReverificationStats.propTypes = {
  totalMembers: PropTypes.number.isRequired,
  overdueCount: PropTypes.number.isRequired,
  dueSoonCount: PropTypes.number.isRequired,
  upcomingCount: PropTypes.number.isRequired,
  notRequiredCount: PropTypes.number.isRequired,
};

/**
 * Upcoming audit schedule component.
 *
 * @param {Object} props
 * @param {string|null} props.lastAuditDate - Last audit date ISO string
 * @param {number} props.totalAudits - Total number of audits performed
 * @returns {React.ReactElement}
 */
function UpcomingAuditSchedule({ lastAuditDate, totalAudits }) {
  const nextAuditDate = useMemo(() => {
    if (!lastAuditDate) {
      return 'Not scheduled';
    }

    try {
      const lastDate = new Date(lastAuditDate);
      if (isNaN(lastDate.getTime())) {
        return 'Not scheduled';
      }

      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 7);

      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, '0');
      const day = String(nextDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return 'Not scheduled';
    }
  }, [lastAuditDate]);

  const daysUntilNextAudit = useMemo(() => {
    if (nextAuditDate === 'Not scheduled') {
      return null;
    }

    try {
      const next = new Date(nextAuditDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffMs = next.getTime() - today.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }, [nextAuditDate]);

  const isOverdue = daysUntilNextAudit !== null && daysUntilNextAudit < 0;
  const isDueSoon = daysUntilNextAudit !== null && daysUntilNextAudit >= 0 && daysUntilNextAudit <= 2;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Audit Schedule
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Audit</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {lastAuditDate ? formatDate(lastAuditDate) : 'Never'}
          </p>
          {lastAuditDate && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {formatRelativeTime(lastAuditDate)}
            </p>
          )}
        </div>

        <div className={`p-3 rounded-lg border ${
          isOverdue ? 'bg-red-50 border-red-200' : isDueSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-csnp-blue-50 border-csnp-blue-100'
        }`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${
            isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-csnp-blue-500'
          }`}>Next Audit</p>
          <p className={`text-xs font-medium mt-0.5 ${
            isOverdue ? 'text-red-700' : isDueSoon ? 'text-yellow-700' : 'text-csnp-primary'
          }`}>
            {nextAuditDate !== 'Not scheduled' ? formatDate(nextAuditDate) : 'Not scheduled'}
          </p>
          {daysUntilNextAudit !== null && (
            <p className={`text-[10px] mt-0.5 font-medium ${
              isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-gray-400'
            }`}>
              {isOverdue
                ? `${Math.abs(daysUntilNextAudit)} day${Math.abs(daysUntilNextAudit) !== 1 ? 's' : ''} overdue`
                : `${daysUntilNextAudit} day${daysUntilNextAudit !== 1 ? 's' : ''} remaining`}
            </p>
          )}
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total Audits</p>
          <p className="text-lg font-bold text-gray-700 mt-0.5">
            {totalAudits}
          </p>
          <p className="text-[10px] text-gray-400">performed</p>
        </div>
      </div>

      {isOverdue && (
        <Alert
          variant="error"
          title="Weekly Audit Overdue"
          showIcon={true}
          bordered={true}
          size="sm"
        >
          The weekly compliance audit is overdue. CMS requires regular C-SNP compliance audits.
          Please run an audit immediately.
        </Alert>
      )}

      {isDueSoon && !isOverdue && (
        <Alert
          variant="warning"
          title="Weekly Audit Due Soon"
          showIcon={true}
          bordered={true}
          size="sm"
        >
          The next weekly compliance audit is due within {daysUntilNextAudit} day{daysUntilNextAudit !== 1 ? 's' : ''}.
        </Alert>
      )}
    </div>
  );
}

UpcomingAuditSchedule.propTypes = {
  lastAuditDate: PropTypes.string,
  totalAudits: PropTypes.number.isRequired,
};

UpcomingAuditSchedule.defaultProps = {
  lastAuditDate: null,
};

/**
 * Skeleton loading state for the compliance dashboard.
 * @returns {React.ReactElement}
 */
function ComplianceDashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-6">
        <div className="w-28 h-28 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Compliance dashboard component.
 * Displays compliance score, CMS regulation adherence status per module,
 * upcoming audit schedule, re-verification statistics, and compliance
 * trend indicators.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Compliance Dashboard'] - Section title
 * @param {boolean} [props.showModuleBreakdown=true] - Whether to show per-module breakdown
 * @param {boolean} [props.showAuditSchedule=true] - Whether to show audit schedule
 * @param {boolean} [props.showReverificationStats=true] - Whether to show re-verification statistics
 * @param {boolean} [props.showTrend=true] - Whether to show compliance trend
 * @param {boolean} [props.showAuditHistory=true] - Whether to show audit history
 * @param {boolean} [props.showAuditButton=true] - Whether to show the run audit button
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ComplianceDashboard({
  showHeader = true,
  title = 'Compliance Dashboard',
  showModuleBreakdown = true,
  showAuditSchedule = true,
  showReverificationStats = true,
  showTrend = true,
  showAuditHistory = true,
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
  const [auditHistory, setAuditHistory] = useState([]);
  const [reverificationData, setReverificationData] = useState({
    totalMembers: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    upcomingCount: 0,
    notRequiredCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [validatingModule, setValidatingModule] = useState(null);

  /**
   * Loads compliance data from the compliance service.
   */
  const loadComplianceData = useCallback(() => {
    setError(null);

    try {
      // Load compliance status
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

      // Load compliance stats
      const stats = getComplianceStats();
      setComplianceStats(stats);

      // Load audit history
      if (showAuditHistory) {
        try {
          const audits = getComplianceAudits();
          setAuditHistory(Array.isArray(audits) ? audits.slice(0, 10) : []);
        } catch {
          setAuditHistory([]);
        }
      }

      // Load re-verification statistics
      if (showReverificationStats) {
        try {
          const storedMembers = localStorage.getItem('csnp_members');
          if (storedMembers) {
            const members = JSON.parse(storedMembers);
            if (Array.isArray(members)) {
              let overdueCount = 0;
              let dueSoonCount = 0;
              let upcomingCount = 0;
              let notRequiredCount = 0;

              for (const member of members) {
                if (member && member.id) {
                  const reverification = checkAnnualReverification(member.id);
                  if (reverification && reverification.required) {
                    if (reverification.daysUntilDue !== null && reverification.daysUntilDue < 0) {
                      overdueCount++;
                    } else if (reverification.daysUntilDue !== null && reverification.daysUntilDue <= 14) {
                      dueSoonCount++;
                    } else {
                      upcomingCount++;
                    }
                  } else {
                    notRequiredCount++;
                  }
                }
              }

              setReverificationData({
                totalMembers: members.length,
                overdueCount,
                dueSoonCount,
                upcomingCount,
                notRequiredCount,
              });
            }
          }
        } catch {
          // Silently fail
        }
      }
    } catch (err) {
      console.error('ComplianceDashboard: failed to load compliance data:', err);
      setError('Unable to load compliance data');
    } finally {
      setLoading(false);
    }
  }, [showAuditHistory, showReverificationStats]);

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
          `Audit completed. Status: ${result.complianceLevel || 'unknown'}. ${result.summary ? result.summary.totalViolations : 0} violation(s), ${result.summary ? result.summary.totalWarnings : 0} warning(s) found.`
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
      console.error('ComplianceDashboard: failed to run audit:', err);
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
   * Handles validating a specific module.
   * @param {string} moduleKey - The module key to validate
   */
  const handleValidateModule = useCallback((moduleKey) => {
    setValidatingModule(moduleKey);

    try {
      const performedBy = user ? user.id : 'system';
      const result = validateCMSCompliance(moduleKey, { performedBy });

      if (result) {
        const moduleName = MODULE_LABELS[moduleKey] || toTitleCase(moduleKey);
        const levelStyle = getLevelStyle(result.complianceLevel);

        addNotification(
          result.compliant ? 'success' : result.complianceLevel === 'minor_issues' ? 'warning' : 'error',
          `${moduleName} Validation`,
          `${moduleName} compliance: ${levelStyle.label}. ${result.violations.length} violation(s), ${result.warnings.length} warning(s).`
        );

        loadComplianceData();
      }
    } catch (err) {
      console.error('ComplianceDashboard: failed to validate module:', err);
      addNotification('error', 'Validation Failed', 'An unexpected error occurred during module validation.');
    } finally {
      setValidatingModule(null);
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
      label: MODULE_LABELS[key] || toTitleCase(key.replace(/_/g, ' ')),
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

  /**
   * Computed: total violations and warnings across all modules.
   */
  const totalIssues = useMemo(() => {
    let violations = 0;
    let warnings = 0;
    let recommendations = 0;

    for (const entry of moduleStatusEntries) {
      if (entry.status) {
        violations += typeof entry.status.violations === 'number' ? entry.status.violations : 0;
        warnings += typeof entry.status.warnings === 'number' ? entry.status.warnings : 0;
        recommendations += typeof entry.status.recommendations === 'number' ? entry.status.recommendations : 0;
      }
    }

    return { violations, warnings, recommendations };
  }, [moduleStatusEntries]);

  /**
   * Computed: recent audits for trend.
   */
  const recentAuditsForTrend = useMemo(() => {
    if (complianceStatus && Array.isArray(complianceStatus.recentAudits)) {
      return complianceStatus.recentAudits;
    }
    return auditHistory;
  }, [complianceStatus, auditHistory]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  /**
   * Renders the Overview tab content.
   */
  function renderOverviewTab() {
    return (
      <div className="space-y-6">
        {/* Top Section: Gauge + Summary */}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Gauge */}
          <div className="flex-shrink-0">
            <ComplianceGauge
              score={levelStyle.score}
              color={levelStyle.gaugeColor}
              label={levelStyle.label}
              size={compact ? 'sm' : 'md'}
            />
          </div>

          {/* Summary Stats */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge
                status={overallLevel}
                size="md"
                showDot={true}
                bordered={true}
              />
              {showTrend && (
                <ComplianceTrendIndicator audits={recentAuditsForTrend} />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Open Findings</p>
                <p className={`text-lg font-bold ${statsSummary.openFindings > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {statsSummary.openFindings}
                </p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Violations</p>
                <p className={`text-lg font-bold ${totalIssues.violations > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {totalIssues.violations}
                </p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Warnings</p>
                <p className={`text-lg font-bold ${totalIssues.warnings > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {totalIssues.warnings}
                </p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Re-Verifications Due</p>
                <p className={`text-lg font-bold ${(reverificationData.overdueCount + reverificationData.dueSoonCount) > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {reverificationData.overdueCount + reverificationData.dueSoonCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Re-Verification Alert */}
        {reverificationData.overdueCount > 0 && (
          <Alert
            variant="error"
            title={`${reverificationData.overdueCount} Member${reverificationData.overdueCount !== 1 ? 's' : ''} Overdue for Re-Verification`}
            showIcon={true}
            bordered={true}
            size="sm"
          >
            CMS requires annual re-verification of chronic condition diagnosis for all C-SNP members.
            Please process overdue re-verifications promptly to maintain compliance.
          </Alert>
        )}

        {/* Non-Compliant Alert */}
        {overallLevel === 'non_compliant' && (
          <Alert
            variant="error"
            title="Non-Compliant Status"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            The system has detected critical compliance violations. Immediate action is required
            to address these issues and restore compliance with CMS regulations.
          </Alert>
        )}

        {/* Major Issues Alert */}
        {overallLevel === 'major_issues' && (
          <Alert
            variant="warning"
            title="Major Compliance Issues Detected"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            Significant compliance issues have been identified. Please review and address
            the violations listed in the module breakdown below.
          </Alert>
        )}

        {/* Audit Schedule */}
        {showAuditSchedule && !compact && (
          <Card bordered={true} flat={false} size="sm">
            <UpcomingAuditSchedule
              lastAuditDate={statsSummary.lastAuditDate}
              totalAudits={statsSummary.totalAudits}
            />
          </Card>
        )}

        {/* Re-Verification Stats */}
        {showReverificationStats && !compact && (
          <Card bordered={true} flat={false} size="sm">
            <ReverificationStats
              totalMembers={reverificationData.totalMembers}
              overdueCount={reverificationData.overdueCount}
              dueSoonCount={reverificationData.dueSoonCount}
              upcomingCount={reverificationData.upcomingCount}
              notRequiredCount={reverificationData.notRequiredCount}
            />
          </Card>
        )}

        {/* Stats Footer */}
        {!compact && (
          <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
            <span>{statsSummary.totalReports} report{statsSummary.totalReports !== 1 ? 's' : ''} generated</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{statsSummary.totalAudits} audit{statsSummary.totalAudits !== 1 ? 's' : ''} performed</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{statsSummary.totalExtracts} extract{statsSummary.totalExtracts !== 1 ? 's' : ''}</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span>{moduleStatusEntries.length} module{moduleStatusEntries.length !== 1 ? 's' : ''} monitored</span>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Module Status tab content.
   */
  function renderModuleStatusTab() {
    if (moduleStatusEntries.length === 0) {
      return (
        <EmptyState
          title="No Module Status Data"
          description="Run a compliance audit to generate module-level compliance status data."
          iconType="no-data"
          size="sm"
          actionLabel={isAuthenticated ? 'Run Audit' : undefined}
          onAction={isAuthenticated ? handleRunAudit : undefined}
          actionVariant="primary"
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            CMS Regulation Adherence by Module ({moduleStatusEntries.length})
          </p>
          <div className="flex items-center gap-3">
            {totalIssues.violations > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-red-700">
                  {totalIssues.violations} violation{totalIssues.violations !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {totalIssues.warnings > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-yellow-700">
                  {totalIssues.warnings} warning{totalIssues.warnings !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {moduleStatusEntries.map((entry) => (
            <ModuleComplianceCard
              key={entry.key}
              moduleName={entry.label}
              moduleKey={entry.key}
              status={entry.status}
              onValidate={handleValidateModule}
              validating={validatingModule === entry.key}
              disabled={!isAuthenticated || validatingModule !== null}
            />
          ))}
        </div>

        {/* All modules without status data */}
        {moduleStatusEntries.length === 0 && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              No module compliance data available. Run a compliance audit to generate module-level status.
            </p>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Audit History tab content.
   */
  function renderAuditHistoryTab() {
    const displayAudits = auditHistory.length > 0
      ? auditHistory
      : (complianceStatus && Array.isArray(complianceStatus.recentAudits) ? complianceStatus.recentAudits : []);

    if (displayAudits.length === 0) {
      return (
        <EmptyState
          title="No Audit History"
          description="No compliance audits have been performed yet. Run a weekly audit to generate compliance data."
          iconType="no-data"
          size="sm"
          actionLabel={isAuthenticated ? 'Run First Audit' : undefined}
          onAction={isAuthenticated ? handleRunAudit : undefined}
          actionVariant="primary"
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Audit History ({displayAudits.length} records)
          </p>
          {showTrend && (
            <ComplianceTrendIndicator audits={displayAudits} />
          )}
        </div>

        <div>
          {displayAudits.map((audit, index) => (
            <AuditHistoryItem
              key={audit.id || `audit-${index}`}
              audit={audit}
              isLast={index === displayAudits.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'overview',
        label: 'Overview',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: !loading && !error ? renderOverviewTab() : null,
      },
    ];

    if (showModuleBreakdown) {
      tabList.push({
        key: 'modules',
        label: 'Module Status',
        badge: totalIssues.violations > 0 ? String(totalIssues.violations) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        content: !loading && !error ? renderModuleStatusTab() : null,
      });
    }

    if (showAuditHistory) {
      tabList.push({
        key: 'history',
        label: 'Audit History',
        badge: auditHistory.length > 0 ? String(auditHistory.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: !loading && !error ? renderAuditHistoryTab() : null,
      });
    }

    return tabList;
  }, [loading, error, complianceStatus, complianceStats, moduleStatusEntries, totalIssues, auditHistory, reverificationData, statsSummary, overallLevel, levelStyle, recentAuditsForTrend, showModuleBreakdown, showAuditHistory, showAuditSchedule, showReverificationStats, showTrend, compact, isAuthenticated, validatingModule, handleValidateModule, handleRunAudit]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
              <div>
                {hasTitle && (
                  <h2 className="text-xl font-semibold text-csnp-primary">
                    {title}
                  </h2>
                )}
                {!compact && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    CMS C-SNP compliance monitoring, audit scheduling, and regulatory adherence tracking.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Run Audit Button */}
              {showAuditButton && isAuthenticated && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAudit}
                  loading={auditRunning}
                  loadingText="Running..."
                  disabled={auditRunning}
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
                  Run Audit
                </Button>
              )}

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadComplianceData}
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

              {headerActions}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <ComplianceDashboardSkeleton />
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
          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="overview"
            variant="underline"
            size="sm"
            className="mb-4"
          />

          {/* CMS Compliance Notice */}
          {!compact && (
            <div className="mt-6">
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
                  This dashboard monitors compliance with CMS regulations for Chronic Condition Special Needs Plans
                  (42 CFR §422.4). Weekly compliance audits are required to ensure adherence to enrollment integrity,
                  claims processing, eligibility verification, provider network adequacy, care management engagement,
                  and audit trail integrity requirements. Annual member re-verification of chronic condition diagnosis
                  is mandated per 42 CFR §422.52. All compliance activities are logged in the audit trail.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

ComplianceDashboard.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showModuleBreakdown: PropTypes.bool,
  showAuditSchedule: PropTypes.bool,
  showReverificationStats: PropTypes.bool,
  showTrend: PropTypes.bool,
  showAuditHistory: PropTypes.bool,
  showAuditButton: PropTypes.bool,
  compact: PropTypes.bool,
  refreshInterval: PropTypes.number,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ComplianceDashboard.defaultProps = {
  showHeader: true,
  title: 'Compliance Dashboard',
  showModuleBreakdown: true,
  showAuditSchedule: true,
  showReverificationStats: true,
  showTrend: true,
  showAuditHistory: true,
  showAuditButton: true,
  compact: false,
  refreshInterval: 0,
  className: '',
  headerActions: null,
};