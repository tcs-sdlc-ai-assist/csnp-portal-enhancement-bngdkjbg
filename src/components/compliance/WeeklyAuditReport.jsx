import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import DataTable from '../common/DataTable.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  runWeeklyAudit,
  getComplianceAudits,
  getComplianceStatus,
  COMPLIANCE_LEVELS,
} from '../../services/complianceService.js';
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
 * Finding type to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, icon: string, label: string }>}
 */
const FINDING_TYPE_STYLES = {
  violation: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600',
    label: 'Violation',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    label: 'Warning',
  },
  recommendation: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    label: 'Recommendation',
  },
};

/**
 * Default finding type style.
 * @type {{ bg: string, text: string, border: string, icon: string, label: string }}
 */
const DEFAULT_FINDING_STYLE = {
  bg: 'bg-gray-50',
  text: 'text-gray-600',
  border: 'border-gray-200',
  icon: 'text-gray-500',
  label: 'Finding',
};

/**
 * Severity to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string }>}
 */
const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

/**
 * Default severity style.
 * @type {{ bg: string, text: string, border: string, dot: string }}
 */
const DEFAULT_SEVERITY_STYLE = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };

/**
 * Finding type filter options.
 * @type {{ value: string, label: string }[]}
 */
const FINDING_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'violation', label: 'Violations' },
  { value: 'warning', label: 'Warnings' },
  { value: 'recommendation', label: 'Recommendations' },
];

/**
 * Module filter options.
 * @type {{ value: string, label: string }[]}
 */
const MODULE_FILTER_OPTIONS = [
  { value: '', label: 'All Modules' },
  ...Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label })),
];

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
 * Returns the finding type style for a given type string.
 * @param {string} type - The finding type
 * @returns {Object} The style object
 */
function getFindingStyle(type) {
  if (typeof type !== 'string' || type.trim().length === 0) {
    return DEFAULT_FINDING_STYLE;
  }
  return FINDING_TYPE_STYLES[type.trim()] || DEFAULT_FINDING_STYLE;
}

/**
 * Returns the severity style for a given severity string.
 * @param {string} severity - The severity level
 * @returns {Object} The style object
 */
function getSeverityStyle(severity) {
  if (typeof severity !== 'string' || severity.trim().length === 0) {
    return DEFAULT_SEVERITY_STYLE;
  }
  return SEVERITY_STYLES[severity.trim()] || DEFAULT_SEVERITY_STYLE;
}

/**
 * Downloads a string as a file.
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('WeeklyAuditReport: failed to download file:', err);
  }
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
 * Skeleton loading state for the weekly audit report.
 * @returns {React.ReactElement}
 */
function WeeklyAuditReportSkeleton() {
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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Single audit finding item component.
 *
 * @param {Object} props
 * @param {Object} props.finding - The finding object
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function FindingItem({ finding, isLast = false }) {
  const findingStyle = getFindingStyle(finding.type);
  const severityStyle = getSeverityStyle(finding.severity);
  const moduleName = MODULE_LABELS[finding.module] || toTitleCase(finding.module || 'general');

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${findingStyle.bg} ${findingStyle.border}`}>
      {/* Type Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${findingStyle.bg} ${findingStyle.icon}`}>
        {finding.type === 'violation' && (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        {finding.type === 'warning' && (
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
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {finding.type === 'recommendation' && (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
        {!finding.type && (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>

      {/* Finding Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${findingStyle.bg} ${findingStyle.text} ${findingStyle.border}`}>
            {findingStyle.label}
          </span>
          {finding.severity && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityStyle.dot}`} aria-hidden="true" />
              {toTitleCase(finding.severity)}
            </span>
          )}
          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {moduleName}
          </span>
          {finding.code && (
            <span className="text-[10px] font-mono text-gray-400">
              {finding.code}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
          {finding.description || 'No description available'}
        </p>

        {finding.regulation && (
          <p className="text-[10px] text-gray-500 mt-1 italic">
            Regulation: {finding.regulation}
          </p>
        )}

        {Array.isArray(finding.affectedRecords) && finding.affectedRecords.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-gray-400">Affected records:</span>
            <span className="text-[10px] font-medium text-gray-600">
              {finding.affectedRecords.length} record{finding.affectedRecords.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {Array.isArray(finding.details) && finding.details.length > 0 && (
          <div className="mt-1.5">
            <ul className="list-disc list-inside space-y-0.5">
              {finding.details.slice(0, 3).map((detail, idx) => (
                <li key={idx} className="text-[10px] text-gray-500">{detail}</li>
              ))}
              {finding.details.length > 3 && (
                <li className="text-[10px] text-gray-400">...and {finding.details.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

FindingItem.propTypes = {
  finding: PropTypes.shape({
    type: PropTypes.string,
    severity: PropTypes.string,
    code: PropTypes.string,
    description: PropTypes.string,
    module: PropTypes.string,
    regulation: PropTypes.string,
    affectedRecords: PropTypes.array,
    details: PropTypes.array,
  }).isRequired,
  isLast: PropTypes.bool,
};

FindingItem.defaultProps = {
  isLast: false,
};

/**
 * Module compliance status card component.
 *
 * @param {Object} props
 * @param {string} props.moduleName - Module display name
 * @param {string} props.moduleKey - Module key
 * @param {Object} props.status - Module status object
 * @returns {React.ReactElement}
 */
function ModuleStatusCard({ moduleName, moduleKey, status }) {
  const level = status && typeof status.complianceLevel === 'string'
    ? status.complianceLevel
    : 'compliant';
  const violations = status && typeof status.violations === 'number' ? status.violations : 0;
  const warnings = status && typeof status.warnings === 'number' ? status.warnings : 0;
  const recommendations = status && typeof status.recommendations === 'number' ? status.recommendations : 0;

  const levelStyle = getLevelStyle(level);

  const statusMap = {
    compliant: 'compliant',
    minor_issues: 'minor_issues',
    major_issues: 'major_issues',
    non_compliant: 'non_compliant',
  };

  const badgeStatus = statusMap[level] || 'pending';

  return (
    <div className={`p-3 rounded-lg border transition-colors duration-150 ${levelStyle.bgColor} ${levelStyle.borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-900">{moduleName}</p>
        <StatusBadge
          status={badgeStatus}
          label={levelStyle.label}
          size="sm"
          showDot={true}
          bordered={false}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
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
            {recommendations} rec{recommendations !== 1 ? 's' : ''}
          </span>
        )}
        {violations === 0 && warnings === 0 && recommendations === 0 && (
          <span className="text-green-600">No issues</span>
        )}
      </div>
    </div>
  );
}

ModuleStatusCard.propTypes = {
  moduleName: PropTypes.string.isRequired,
  moduleKey: PropTypes.string.isRequired,
  status: PropTypes.shape({
    complianceLevel: PropTypes.string,
    violations: PropTypes.number,
    warnings: PropTypes.number,
    recommendations: PropTypes.number,
  }),
};

ModuleStatusCard.defaultProps = {
  status: null,
};

/**
 * Audit history item component.
 *
 * @param {Object} props
 * @param {Object} props.audit - The audit record
 * @param {Function} props.onSelect - Selection handler
 * @param {boolean} props.isSelected - Whether this audit is currently selected
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AuditHistoryItem({ audit, onSelect, isSelected, isLast = false }) {
  const levelStyle = getLevelStyle(audit.complianceLevel);

  return (
    <button
      type="button"
      onClick={() => onSelect(audit)}
      className={`w-full text-left flex items-start gap-3 py-3 transition-colors duration-150 ${
        !isLast ? 'border-b border-gray-100' : ''
      } ${isSelected ? 'bg-csnp-blue-50 -mx-2 px-2 rounded-lg' : 'hover:bg-gray-50 -mx-2 px-2 rounded-lg'}`}
    >
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
              {audit.auditType ? toTitleCase(audit.auditType) : 'Weekly'} Audit
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
                <span className="text-blue-500 font-medium">{audit.summary.totalRecommendations} rec{audit.summary.totalRecommendations !== 1 ? 's' : ''}</span>
              )}
              {audit.summary.totalViolations === 0 && audit.summary.totalWarnings === 0 && audit.summary.totalRecommendations === 0 && (
                <span className="text-green-500">No issues</span>
              )}
            </>
          )}
          {!audit.summary && typeof audit.totalViolations === 'number' && (
            <>
              {audit.totalViolations > 0 && (
                <span className="text-red-500 font-medium">{audit.totalViolations} violation{audit.totalViolations !== 1 ? 's' : ''}</span>
              )}
              {typeof audit.totalWarnings === 'number' && audit.totalWarnings > 0 && (
                <span className="text-yellow-500 font-medium">{audit.totalWarnings} warning{audit.totalWarnings !== 1 ? 's' : ''}</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
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
    findings: PropTypes.array,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isLast: PropTypes.bool,
};

AuditHistoryItem.defaultProps = {
  isLast: false,
};

/**
 * Audit detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.finding - The finding to display
 * @returns {React.ReactElement|null}
 */
function FindingDetailModal({ isOpen, onClose, finding }) {
  if (!finding) {
    return null;
  }

  const findingStyle = getFindingStyle(finding.type);
  const severityStyle = getSeverityStyle(finding.severity);
  const moduleName = MODULE_LABELS[finding.module] || toTitleCase(finding.module || 'general');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Finding Details"
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Finding Banner */}
        <div className={`p-3 rounded-lg border ${findingStyle.bg} ${findingStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${findingStyle.bg} ${findingStyle.text} ${findingStyle.border}`}>
                {findingStyle.label}
              </span>
              {finding.severity && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityStyle.dot}`} aria-hidden="true" />
                  {toTitleCase(finding.severity)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Finding Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Code</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{finding.code || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Module</p>
            <p className="text-xs text-gray-700 mt-0.5">{moduleName}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{findingStyle.label}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Severity</p>
            <p className="text-xs text-gray-700 mt-0.5">{finding.severity ? toTitleCase(finding.severity) : '—'}</p>
          </div>
        </div>

        {/* Description */}
        {finding.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {finding.description}
              </p>
            </div>
          </div>
        )}

        {/* Regulation */}
        {finding.regulation && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Regulation Reference</p>
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <p className="text-xs text-csnp-blue-700 leading-relaxed">
                {finding.regulation}
              </p>
            </div>
          </div>
        )}

        {/* Affected Records */}
        {Array.isArray(finding.affectedRecords) && finding.affectedRecords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Affected Records ({finding.affectedRecords.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {finding.affectedRecords.slice(0, 10).map((recordId, idx) => (
                <span
                  key={`${recordId}-${idx}`}
                  className="inline-block px-2 py-0.5 text-[10px] font-mono font-medium bg-gray-100 text-gray-600 rounded border border-gray-200"
                  title={recordId}
                >
                  {typeof recordId === 'string' && recordId.length > 16 ? recordId.substring(0, 16) + '…' : recordId}
                </span>
              ))}
              {finding.affectedRecords.length > 10 && (
                <span className="text-[10px] text-gray-400 self-center">
                  +{finding.affectedRecords.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Details */}
        {Array.isArray(finding.details) && finding.details.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Details ({finding.details.length})
            </p>
            <div className="space-y-1.5">
              {finding.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                  <p className="text-xs text-gray-700">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Corrective Action */}
        {finding.type === 'violation' && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-red-800">Corrective Action Required</p>
              <p className="text-[10px] text-red-700 mt-0.5">
                This violation must be addressed to maintain CMS compliance. Review the affected records and take corrective action within the required timeframe.
              </p>
            </div>
          </div>
        )}

        {finding.type === 'warning' && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-yellow-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-yellow-800">Attention Recommended</p>
              <p className="text-[10px] text-yellow-700 mt-0.5">
                This warning indicates a potential compliance risk. Address this issue proactively to prevent it from becoming a violation.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

FindingDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  finding: PropTypes.object,
};

FindingDetailModal.defaultProps = {
  finding: null,
};

/**
 * Weekly C-SNP audit report component.
 * Displays audit findings, compliance violations, corrective actions,
 * and audit summary. Supports running new audit via complianceService.runWeeklyAudit.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Weekly Audit Report'] - Section title
 * @param {boolean} [props.showRunAuditButton=true] - Whether to show the run audit button
 * @param {boolean} [props.showHistory=true] - Whether to show audit history
 * @param {boolean} [props.showModuleBreakdown=true] - Whether to show per-module breakdown
 * @param {boolean} [props.showExport=true] - Whether to show export buttons
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onAuditComplete] - Callback when audit completes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function WeeklyAuditReport({
  showHeader = true,
  title = 'Weekly Audit Report',
  showRunAuditButton = true,
  showHistory = true,
  showModuleBreakdown = true,
  showExport = true,
  compact = false,
  onAuditComplete,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [auditHistory, setAuditHistory] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [findingTypeFilter, setFindingTypeFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [findingDetailOpen, setFindingDetailOpen] = useState(false);

  /**
   * Loads audit history from the compliance service.
   */
  const loadAuditHistory = useCallback(() => {
    setError(null);

    try {
      const audits = getComplianceAudits();
      setAuditHistory(Array.isArray(audits) ? audits : []);

      // Auto-select the most recent audit
      if (Array.isArray(audits) && audits.length > 0 && !selectedAudit) {
        setSelectedAudit(audits[0]);
      }
    } catch (err) {
      console.error('WeeklyAuditReport: failed to load audit history:', err);
      setError('Unable to load audit history');
    } finally {
      setLoading(false);
    }
  }, [selectedAudit]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadAuditHistory();
  }, [loadAuditHistory]);

  /**
   * Handles running a new weekly audit.
   */
  const handleRunAudit = useCallback(() => {
    setAuditRunning(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = runWeeklyAudit({ performedBy });

      if (result && result.success) {
        addNotification(
          'success',
          'Weekly Audit Complete',
          `Audit completed. Status: ${result.complianceLevel || 'unknown'}. ${result.summary ? result.summary.totalViolations : 0} violation(s), ${result.summary ? result.summary.totalWarnings : 0} warning(s) found.`
        );

        // Reload history and select the new audit
        const updatedAudits = getComplianceAudits();
        setAuditHistory(Array.isArray(updatedAudits) ? updatedAudits : []);

        if (Array.isArray(updatedAudits) && updatedAudits.length > 0) {
          setSelectedAudit(updatedAudits[0]);
        }

        if (typeof onAuditComplete === 'function') {
          onAuditComplete(result);
        }
      } else {
        addNotification(
          'error',
          'Audit Failed',
          result && result.error ? result.error : 'An error occurred while running the weekly audit.'
        );
      }
    } catch (err) {
      console.error('WeeklyAuditReport: failed to run audit:', err);
      addNotification(
        'error',
        'Audit Failed',
        'An unexpected error occurred while running the weekly audit.'
      );
    } finally {
      setAuditRunning(false);
    }
  }, [user, addNotification, onAuditComplete]);

  /**
   * Handles selecting an audit from history.
   * @param {Object} audit - The audit record
   */
  const handleSelectAudit = useCallback((audit) => {
    setSelectedAudit(audit);
    setFindingTypeFilter('');
    setModuleFilter('');
  }, []);

  /**
   * Handles viewing a finding's details.
   * @param {Object} finding - The finding object
   */
  const handleViewFinding = useCallback((finding) => {
    setSelectedFinding(finding);
    setFindingDetailOpen(true);
  }, []);

  /**
   * Handles closing the finding detail modal.
   */
  const handleCloseFindingDetail = useCallback(() => {
    setFindingDetailOpen(false);
    setSelectedFinding(null);
  }, []);

  /**
   * Computed: selected audit compliance level and style.
   */
  const auditLevelStyle = useMemo(() => {
    if (!selectedAudit) {
      return DEFAULT_LEVEL_STYLE;
    }
    return getLevelStyle(selectedAudit.complianceLevel);
  }, [selectedAudit]);

  /**
   * Computed: selected audit summary.
   */
  const auditSummary = useMemo(() => {
    if (!selectedAudit || !selectedAudit.summary) {
      return {
        totalViolations: 0,
        criticalViolations: 0,
        highViolations: 0,
        totalWarnings: 0,
        totalRecommendations: 0,
        overallComplianceLevel: selectedAudit ? selectedAudit.complianceLevel : 'compliant',
        moduleResults: {},
      };
    }
    return selectedAudit.summary;
  }, [selectedAudit]);

  /**
   * Computed: selected audit findings.
   */
  const auditFindings = useMemo(() => {
    if (!selectedAudit || !Array.isArray(selectedAudit.findings)) {
      return [];
    }
    return selectedAudit.findings;
  }, [selectedAudit]);

  /**
   * Computed: filtered findings.
   */
  const filteredFindings = useMemo(() => {
    let filtered = auditFindings;

    if (findingTypeFilter && findingTypeFilter.trim().length > 0) {
      filtered = filtered.filter((f) => f.type === findingTypeFilter.trim());
    }

    if (moduleFilter && moduleFilter.trim().length > 0) {
      filtered = filtered.filter((f) => f.module === moduleFilter.trim());
    }

    return filtered;
  }, [auditFindings, findingTypeFilter, moduleFilter]);

  /**
   * Computed: violations from findings.
   */
  const violations = useMemo(() => {
    return auditFindings.filter((f) => f.type === 'violation');
  }, [auditFindings]);

  /**
   * Computed: warnings from findings.
   */
  const warnings = useMemo(() => {
    return auditFindings.filter((f) => f.type === 'warning');
  }, [auditFindings]);

  /**
   * Computed: recommendations from findings.
   */
  const recommendations = useMemo(() => {
    return auditFindings.filter((f) => f.type === 'recommendation');
  }, [auditFindings]);

  /**
   * Computed: module status entries.
   */
  const moduleStatusEntries = useMemo(() => {
    if (!auditSummary.moduleResults || typeof auditSummary.moduleResults !== 'object') {
      return [];
    }

    return Object.entries(auditSummary.moduleResults).map(([key, value]) => ({
      key,
      label: MODULE_LABELS[key] || toTitleCase(key.replace(/_/g, ' ')),
      status: value,
    }));
  }, [auditSummary]);

  /**
   * Handles exporting the audit report as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (!selectedAudit) {
      addNotification('warning', 'No Audit Selected', 'Please select an audit to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        auditId: selectedAudit.id,
        auditType: selectedAudit.auditType || 'weekly',
        complianceLevel: selectedAudit.complianceLevel,
        performedAt: selectedAudit.performedAt || selectedAudit.createdAt,
        summary: selectedAudit.summary,
        findings: selectedAudit.findings,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `weekly_audit_report_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', 'Audit report exported as JSON.');
    } catch (err) {
      console.error('WeeklyAuditReport: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting the audit report.');
    }
  }, [selectedAudit, addNotification]);

  /**
   * Handles exporting the audit report as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (!selectedAudit || !Array.isArray(selectedAudit.findings) || selectedAudit.findings.length === 0) {
      addNotification('warning', 'No Findings', 'No audit findings to export.');
      return;
    }

    try {
      const headers = ['Type', 'Severity', 'Code', 'Module', 'Description', 'Regulation', 'Affected Records'];

      const escapeCSV = (val) => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = selectedAudit.findings.map((finding) => [
        finding.type || '',
        finding.severity || '',
        finding.code || '',
        finding.module || '',
        finding.description || '',
        finding.regulation || '',
        Array.isArray(finding.affectedRecords) ? finding.affectedRecords.join('; ') : '',
      ]);

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ];

      const csv = csvLines.join('\n');
      const filename = `weekly_audit_findings_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${selectedAudit.findings.length} finding(s) to CSV.`);
    } catch (err) {
      console.error('WeeklyAuditReport: CSV export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting audit findings.');
    }
  }, [selectedAudit, addNotification]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  /**
   * Renders the Findings tab content.
   */
  function renderFindingsTab() {
    if (auditFindings.length === 0) {
      return (
        <EmptyState
          title="No Findings"
          description="This audit did not produce any findings. The system is fully compliant."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-4">
        {/* Filters */}
        {!compact && (
          <div className="flex items-center gap-2">
            <select
              value={findingTypeFilter}
              onChange={(e) => setFindingTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
              aria-label="Filter by finding type"
            >
              {FINDING_TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
              aria-label="Filter by module"
            >
              {MODULE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <span className="text-[10px] text-gray-400 ml-auto">
              {filteredFindings.length} of {auditFindings.length} finding{auditFindings.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Finding Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          {violations.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-red-700">
                {violations.length} violation{violations.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-yellow-700">
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {recommendations.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-blue-700">
                {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Violations Section */}
        {filteredFindings.filter((f) => f.type === 'violation').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Violations ({filteredFindings.filter((f) => f.type === 'violation').length})
            </p>
            <div className="space-y-2">
              {filteredFindings
                .filter((f) => f.type === 'violation')
                .map((finding, idx) => (
                  <div
                    key={`violation-${idx}`}
                    className="cursor-pointer"
                    onClick={() => handleViewFinding(finding)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewFinding(finding);
                      }
                    }}
                  >
                    <FindingItem finding={finding} />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Warnings Section */}
        {filteredFindings.filter((f) => f.type === 'warning').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Warnings ({filteredFindings.filter((f) => f.type === 'warning').length})
            </p>
            <div className="space-y-2">
              {filteredFindings
                .filter((f) => f.type === 'warning')
                .map((finding, idx) => (
                  <div
                    key={`warning-${idx}`}
                    className="cursor-pointer"
                    onClick={() => handleViewFinding(finding)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewFinding(finding);
                      }
                    }}
                  >
                    <FindingItem finding={finding} />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {filteredFindings.filter((f) => f.type === 'recommendation').length > 0 && !compact && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Recommendations ({filteredFindings.filter((f) => f.type === 'recommendation').length})
            </p>
            <div className="space-y-2">
              {filteredFindings
                .filter((f) => f.type === 'recommendation')
                .map((finding, idx) => (
                  <div
                    key={`recommendation-${idx}`}
                    className="cursor-pointer"
                    onClick={() => handleViewFinding(finding)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewFinding(finding);
                      }
                    }}
                  >
                    <FindingItem finding={finding} />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Filtered Empty State */}
        {filteredFindings.length === 0 && auditFindings.length > 0 && (
          <EmptyState
            title="No Matching Findings"
            description="No findings match the selected filters."
            iconType="no-results"
            size="sm"
            actionLabel="Clear Filters"
            onAction={() => {
              setFindingTypeFilter('');
              setModuleFilter('');
            }}
            actionVariant="outline"
          />
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
          description="No module-level compliance data is available for this audit."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Module Compliance Status ({moduleStatusEntries.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {moduleStatusEntries.map((entry) => (
            <ModuleStatusCard
              key={entry.key}
              moduleName={entry.label}
              moduleKey={entry.key}
              status={entry.status}
            />
          ))}
        </div>
      </div>
    );
  }

  /**
   * Renders the Corrective Actions tab content.
   */
  function renderCorrectiveActionsTab() {
    const actionableFindings = auditFindings.filter(
      (f) => f.type === 'violation' || (f.type === 'warning' && f.severity === 'high')
    );

    if (actionableFindings.length === 0) {
      return (
        <EmptyState
          title="No Corrective Actions Required"
          description="No violations or high-severity warnings were found that require corrective action."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Required Corrective Actions ({actionableFindings.length})
          </p>
          {actionableFindings.filter((f) => f.type === 'violation').length > 0 && (
            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              {actionableFindings.filter((f) => f.type === 'violation').length} violation{actionableFindings.filter((f) => f.type === 'violation').length !== 1 ? 's' : ''} require action
            </span>
          )}
        </div>

        {/* Critical/High Violations */}
        {actionableFindings.filter((f) => f.type === 'violation' && (f.severity === 'critical' || f.severity === 'high')).length > 0 && (
          <Alert
            variant="error"
            title="Critical/High Severity Violations"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            {actionableFindings.filter((f) => f.type === 'violation' && (f.severity === 'critical' || f.severity === 'high')).length} critical or high severity violation(s) require immediate corrective action to maintain CMS compliance.
          </Alert>
        )}

        <div className="space-y-3">
          {actionableFindings.map((finding, idx) => {
            const findingStyle = getFindingStyle(finding.type);
            const severityStyle = getSeverityStyle(finding.severity);
            const moduleName = MODULE_LABELS[finding.module] || toTitleCase(finding.module || 'general');

            return (
              <div
                key={`action-${idx}`}
                className={`p-4 rounded-lg border ${findingStyle.bg} ${findingStyle.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${finding.type === 'violation' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    <span className="text-sm font-bold">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${findingStyle.bg} ${findingStyle.text} ${findingStyle.border}`}>
                        {findingStyle.label}
                      </span>
                      {finding.severity && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityStyle.dot}`} aria-hidden="true" />
                          {toTitleCase(finding.severity)}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">{moduleName}</span>
                      {finding.code && (
                        <span className="text-[10px] font-mono text-gray-400">{finding.code}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {finding.description || 'No description available'}
                    </p>
                    {finding.regulation && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">
                        {finding.regulation}
                      </p>
                    )}
                    <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Corrective Action</p>
                      <p className="text-xs text-gray-700">
                        {finding.type === 'violation'
                          ? 'Review and remediate the affected records. Ensure compliance with the referenced CMS regulation. Document corrective actions taken and update the compliance status.'
                          : 'Monitor this issue and take preventive measures to avoid escalation to a violation. Review affected processes and implement improvements.'}
                      </p>
                    </div>
                    {Array.isArray(finding.affectedRecords) && finding.affectedRecords.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        {finding.affectedRecords.length} affected record{finding.affectedRecords.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /**
   * Renders the History tab content.
   */
  function renderHistoryTab() {
    if (auditHistory.length === 0) {
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
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Audit History ({auditHistory.length} records)
        </p>
        <div>
          {auditHistory.slice(0, 10).map((audit, index) => (
            <AuditHistoryItem
              key={audit.id || `audit-${index}`}
              audit={audit}
              onSelect={handleSelectAudit}
              isSelected={selectedAudit && selectedAudit.id === audit.id}
              isLast={index === Math.min(auditHistory.length, 10) - 1}
            />
          ))}
          {auditHistory.length > 10 && (
            <p className="text-[10px] text-gray-400 text-center pt-2">
              Showing 10 of {auditHistory.length} audits
            </p>
          )}
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
        key: 'findings',
        label: 'Findings',
        badge: auditFindings.length > 0 ? String(auditFindings.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        content: !loading && !error && selectedAudit ? renderFindingsTab() : null,
      },
      {
        key: 'corrective_actions',
        label: 'Corrective Actions',
        badge: violations.length > 0 ? String(violations.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        content: !loading && !error && selectedAudit ? renderCorrectiveActionsTab() : null,
      },
    ];

    if (showModuleBreakdown) {
      tabList.push({
        key: 'modules',
        label: 'Module Status',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: !loading && !error && selectedAudit ? renderModuleStatusTab() : null,
      });
    }

    if (showHistory) {
      tabList.push({
        key: 'history',
        label: 'Audit History',
        badge: auditHistory.length > 0 ? String(auditHistory.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: !loading && !error ? renderHistoryTab() : null,
      });
    }

    return tabList;
  }, [loading, error, selectedAudit, auditFindings, filteredFindings, violations, warnings, recommendations, moduleStatusEntries, auditHistory, showModuleBreakdown, showHistory, compact, findingTypeFilter, moduleFilter, isAuthenticated, handleRunAudit, handleSelectAudit, handleViewFinding]);

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
                    Weekly C-SNP compliance audit findings, violations, corrective actions, and module status.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Run Audit Button */}
              {showRunAuditButton && isAuthenticated && (
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

              {/* Export Buttons */}
              {showExport && selectedAudit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
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
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
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
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    JSON
                  </Button>
                </>
              )}

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadAuditHistory}
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
        <WeeklyAuditReportSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load audit data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadAuditHistory}
          actionVariant="outline"
        />
      )}

      {/* No Audits State */}
      {!loading && !error && auditHistory.length === 0 && (
        <EmptyState
          title="No Audit Reports"
          description="No weekly compliance audits have been performed yet. Run a weekly audit to generate a compliance report with findings and corrective actions."
          iconType="no-data"
          size="sm"
          actionLabel={isAuthenticated ? 'Run First Audit' : undefined}
          onAction={isAuthenticated ? handleRunAudit : undefined}
          actionVariant="primary"
          actionIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
      )}

      {/* Audit Report Content */}
      {!loading && !error && selectedAudit && (
        <>
          {/* Audit Summary Section */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Gauge */}
              <div className="flex-shrink-0">
                <ComplianceGauge
                  score={auditLevelStyle.score}
                  color={auditLevelStyle.gaugeColor}
                  label={auditLevelStyle.label}
                  size={compact ? 'sm' : 'md'}
                />
              </div>

              {/* Summary Stats */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge
                    status={selectedAudit.complianceLevel || 'compliant'}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                  <span className="text-xs text-gray-500">
                    {selectedAudit.performedAt
                      ? `Performed ${formatRelativeTime(selectedAudit.performedAt)}`
                      : selectedAudit.createdAt
                        ? `Created ${formatRelativeTime(selectedAudit.createdAt)}`
                        : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Violations</p>
                    <p className={`text-lg font-bold ${auditSummary.totalViolations > 0 ? 'text-red-700' : 'text-red-400'}`}>
                      {auditSummary.totalViolations || 0}
                    </p>
                    {typeof auditSummary.criticalViolations === 'number' && auditSummary.criticalViolations > 0 && (
                      <p className="text-[10px] text-red-600 font-medium">{auditSummary.criticalViolations} critical</p>
                    )}
                  </div>
                  <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Warnings</p>
                    <p className={`text-lg font-bold ${auditSummary.totalWarnings > 0 ? 'text-yellow-700' : 'text-yellow-400'}`}>
                      {auditSummary.totalWarnings || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Recommendations</p>
                    <p className="text-lg font-bold text-blue-700">
                      {auditSummary.totalRecommendations || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Findings</p>
                    <p className="text-lg font-bold text-gray-700">
                      {auditFindings.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Violations Alert */}
          {auditSummary.criticalViolations > 0 && (
            <Alert
              variant="error"
              title={`${auditSummary.criticalViolations} Critical Violation${auditSummary.criticalViolations !== 1 ? 's' : ''} Found`}
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              Critical compliance violations require immediate corrective action. Review the findings and take corrective measures to restore CMS compliance.
            </Alert>
          )}

          {/* Non-Compliant Alert */}
          {selectedAudit.complianceLevel === 'non_compliant' && auditSummary.criticalViolations === 0 && (
            <Alert
              variant="error"
              title="Non-Compliant Status"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              The system has been assessed as non-compliant. Immediate action is required to address the identified violations and restore compliance with CMS regulations.
            </Alert>
          )}

          {/* Major Issues Alert */}
          {selectedAudit.complianceLevel === 'major_issues' && (
            <Alert
              variant="warning"
              title="Major Compliance Issues Detected"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              Significant compliance issues have been identified. Please review and address the violations listed in the findings below.
            </Alert>
          )}

          {/* Compliant Status */}
          {selectedAudit.complianceLevel === 'compliant' && (
            <Alert
              variant="success"
              title="Fully Compliant"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              The weekly audit found no compliance violations. The system is fully compliant with CMS C-SNP regulations.
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="findings"
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
                  Weekly compliance audits are required for Chronic Condition Special Needs Plans per CMS regulations
                  (42 CFR §422.4). All violations must be addressed with documented corrective actions within the
                  required timeframe. Audit findings, corrective actions, and compliance status are tracked in the
                  audit trail. Regular audits help ensure continued adherence to enrollment integrity, claims processing,
                  eligibility verification, provider network adequacy, care management engagement, and audit trail
                  integrity requirements.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Finding Detail Modal */}
      <FindingDetailModal
        isOpen={findingDetailOpen}
        onClose={handleCloseFindingDetail}
        finding={selectedFinding}
      />
    </div>
  );
}

WeeklyAuditReport.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showRunAuditButton: PropTypes.bool,
  showHistory: PropTypes.bool,
  showModuleBreakdown: PropTypes.bool,
  showExport: PropTypes.bool,
  compact: PropTypes.bool,
  onAuditComplete: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

WeeklyAuditReport.defaultProps = {
  showHeader: true,
  title: 'Weekly Audit Report',
  showRunAuditButton: true,
  showHistory: true,
  showModuleBreakdown: true,
  showExport: true,
  compact: false,
  onAuditComplete: undefined,
  className: '',
  headerActions: null,
};