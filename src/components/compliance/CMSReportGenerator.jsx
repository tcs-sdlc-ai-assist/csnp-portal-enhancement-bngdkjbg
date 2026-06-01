import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import FormField from '../common/FormField.jsx';
import Modal from '../common/Modal.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import DataTable from '../common/DataTable.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  generateCMSReport,
  getComplianceReports,
  getComplianceReportById,
  CMS_REPORT_TYPES,
  CMS_REPORT_TYPE_LABELS,
} from '../../services/complianceService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  toTitleCase,
} from '../../utils/helpers.js';

/**
 * Report type options for the select field.
 * @type {{ value: string, label: string, description: string }[]}
 */
const REPORT_TYPE_OPTIONS = [
  {
    value: CMS_REPORT_TYPES.ENROLLMENT_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.ENROLLMENT_SUMMARY],
    description: 'Summary of enrollment activity including status, channel, plan type, and condition category breakdowns.',
  },
  {
    value: CMS_REPORT_TYPES.CLAIMS_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.CLAIMS_SUMMARY],
    description: 'Summary of claims activity including financial totals, denial rates, and status breakdowns.',
  },
  {
    value: CMS_REPORT_TYPES.CARE_MANAGEMENT_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.CARE_MANAGEMENT_SUMMARY],
    description: 'Summary of care management events, member engagement, and event type breakdowns.',
  },
  {
    value: CMS_REPORT_TYPES.PROVIDER_NETWORK_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.PROVIDER_NETWORK_SUMMARY],
    description: 'Summary of provider network including network adequacy, specialty distribution, and referral activity.',
  },
  {
    value: CMS_REPORT_TYPES.ELIGIBILITY_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.ELIGIBILITY_SUMMARY],
    description: 'Summary of eligibility validations including eligibility rates and condition category breakdowns.',
  },
  {
    value: CMS_REPORT_TYPES.FINANCIAL_SUMMARY,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.FINANCIAL_SUMMARY],
    description: 'Financial summary including claim financials, premium revenue, medical loss ratio, and top providers by spend.',
  },
  {
    value: CMS_REPORT_TYPES.COMPLIANCE_AUDIT,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.COMPLIANCE_AUDIT],
    description: 'Compliance audit report including audit trail integrity, action breakdowns, and module activity.',
  },
  {
    value: CMS_REPORT_TYPES.QUALITY_MEASURES,
    label: CMS_REPORT_TYPE_LABELS[CMS_REPORT_TYPES.QUALITY_MEASURES],
    description: 'Quality measures report including care management engagement, claims utilization, and CSNP-specific measures.',
  },
];

/**
 * Report type select options for FormField.
 * @type {{ value: string, label: string }[]}
 */
const REPORT_TYPE_SELECT_OPTIONS = REPORT_TYPE_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

/**
 * Quick date range presets.
 * @type {{ value: string, label: string, getRange: function(): { startDate: string, endDate: string } }[]}
 */
const DATE_RANGE_PRESETS = [
  {
    value: 'last_7_days',
    label: 'Last 7 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'last_30_days',
    label: 'Last 30 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'last_90_days',
    label: 'Last 90 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'this_month',
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'last_month',
    label: 'Last Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'this_quarter',
    label: 'This Quarter',
    getRange: () => {
      const now = new Date();
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStart, 1);
      const end = new Date();
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'this_year',
    label: 'This Year',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date();
      return {
        startDate: formatISODate(start),
        endDate: formatISODate(end),
      };
    },
  },
  {
    value: 'custom',
    label: 'Custom Range',
    getRange: () => ({
      startDate: '',
      endDate: '',
    }),
  },
];

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date - The date to format
 * @returns {string} ISO date string
 */
function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    console.error('CMSReportGenerator: failed to download file:', err);
  }
}

/**
 * Builds a CSV string from a report data object.
 * @param {Object} reportData - The report data
 * @param {string} reportType - The report type
 * @returns {string} CSV string
 */
function buildReportCSV(reportData, reportType) {
  if (!reportData || typeof reportData !== 'object') {
    return '';
  }

  const lines = [];
  lines.push(`Report Type,${CMS_REPORT_TYPE_LABELS[reportType] || reportType}`);

  if (reportData.reportPeriod) {
    lines.push(`Start Date,${reportData.reportPeriod.startDate || ''}`);
    lines.push(`End Date,${reportData.reportPeriod.endDate || ''}`);
  }

  lines.push('');

  const escapeCSV = (val) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  function flattenObject(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        flattenObject(value, fullKey);
      } else if (Array.isArray(value)) {
        lines.push(`${escapeCSV(fullKey)},${escapeCSV(JSON.stringify(value))}`);
      } else {
        lines.push(`${escapeCSV(fullKey)},${escapeCSV(value)}`);
      }
    }
  }

  flattenObject(reportData, '');

  return lines.join('\n');
}

/**
 * Report type card component for visual selection.
 *
 * @param {Object} props
 * @param {Object} props.reportOption - The report type option object
 * @param {boolean} props.selected - Whether this report type is selected
 * @param {Function} props.onSelect - Selection handler
 * @param {boolean} [props.disabled=false] - Whether the card is disabled
 * @returns {React.ReactElement}
 */
function ReportTypeCard({ reportOption, selected, onSelect, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(reportOption.value)}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
        selected
          ? 'bg-csnp-blue-50 border-csnp-primary shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-2">
        <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5 ${
          selected ? 'bg-csnp-primary text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          {selected ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
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
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${selected ? 'text-csnp-primary' : 'text-gray-900'}`}>
            {reportOption.label}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
            {reportOption.description}
          </p>
        </div>
      </div>
    </button>
  );
}

ReportTypeCard.propTypes = {
  reportOption: PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ReportTypeCard.defaultProps = {
  disabled: false,
};

/**
 * Report preview component for displaying generated report data.
 *
 * @param {Object} props
 * @param {Object} props.result - The CMS report generation result
 * @param {Function} props.onDownloadJSON - JSON download handler
 * @param {Function} props.onDownloadCSV - CSV download handler
 * @param {Function} props.onDismiss - Dismiss handler
 * @returns {React.ReactElement|null}
 */
function ReportPreview({ result, onDownloadJSON, onDownloadCSV, onDismiss }) {
  if (!result) {
    return null;
  }

  const reportData = result.reportData;
  const reportType = result.reportType;
  const reportTypeLabel = result.reportTypeLabel || CMS_REPORT_TYPE_LABELS[reportType] || reportType;

  return (
    <div className="space-y-4">
      {/* Result Banner */}
      <Alert
        variant={result.success ? 'success' : 'error'}
        title={result.success ? 'Report Generated Successfully' : 'Report Generation Failed'}
        showIcon={true}
        bordered={true}
      >
        {result.success ? (
          <div>
            <p>
              The {reportTypeLabel} has been generated successfully.
              {result.reportId && (
                <span> Report ID: <strong>{result.reportId.substring(0, 16)}…</strong></span>
              )}
            </p>
          </div>
        ) : (
          <p>{result.error || 'An error occurred while generating the CMS report.'}</p>
        )}
      </Alert>

      {result.success && reportData && (
        <>
          {/* Report Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Report Type</p>
              <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={reportTypeLabel}>
                {reportTypeLabel}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Report ID</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={result.reportId}>
                {result.reportId ? result.reportId.substring(0, 12) + '…' : '—'}
              </p>
            </div>
            {reportData.reportPeriod && (
              <>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Start Date</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {reportData.reportPeriod.startDate ? formatDate(reportData.reportPeriod.startDate) : '—'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">End Date</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {reportData.reportPeriod.endDate ? formatDate(reportData.reportPeriod.endDate) : '—'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Report Data Preview */}
          {renderReportDataPreview(reportData, reportType)}

          {/* Download Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onDownloadJSON}
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
                Download JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadCSV}
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
                Download CSV
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
            >
              Generate Another
            </Button>
          </div>
        </>
      )}

      {!result.success && (
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a preview of the report data based on report type.
 * @param {Object} reportData - The report data
 * @param {string} reportType - The report type
 * @returns {React.ReactElement}
 */
function renderReportDataPreview(reportData, reportType) {
  if (!reportData || typeof reportData !== 'object') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <p className="text-xs text-gray-400">No report data available for preview.</p>
      </div>
    );
  }

  switch (reportType) {
    case CMS_REPORT_TYPES.ENROLLMENT_SUMMARY:
      return renderEnrollmentSummaryPreview(reportData);
    case CMS_REPORT_TYPES.CLAIMS_SUMMARY:
      return renderClaimsSummaryPreview(reportData);
    case CMS_REPORT_TYPES.CARE_MANAGEMENT_SUMMARY:
      return renderCareManagementPreview(reportData);
    case CMS_REPORT_TYPES.PROVIDER_NETWORK_SUMMARY:
      return renderProviderNetworkPreview(reportData);
    case CMS_REPORT_TYPES.FINANCIAL_SUMMARY:
      return renderFinancialSummaryPreview(reportData);
    case CMS_REPORT_TYPES.QUALITY_MEASURES:
      return renderQualityMeasuresPreview(reportData);
    case CMS_REPORT_TYPES.COMPLIANCE_AUDIT:
      return renderComplianceAuditPreview(reportData);
    case CMS_REPORT_TYPES.ELIGIBILITY_SUMMARY:
      return renderEligibilitySummaryPreview(reportData);
    default:
      return renderGenericPreview(reportData);
  }
}

/**
 * Renders enrollment summary preview.
 */
function renderEnrollmentSummaryPreview(data) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrollment Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total in Period</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalEnrollmentsInPeriod || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Active</p>
          <p className="text-lg font-bold text-green-700">{data.totalActiveEnrollments || 0}</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Pending</p>
          <p className="text-lg font-bold text-yellow-700">{data.totalPendingEnrollments || 0}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">CSNP Rate</p>
          <p className="text-lg font-bold text-gray-700">{data.csnpEnrollmentRate || 0}%</p>
        </div>
      </div>
      {data.byStatus && Object.keys(data.byStatus).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">By Status</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <span key={status} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {toTitleCase(status)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders claims summary preview.
 */
function renderClaimsSummaryPreview(data) {
  const financials = data.financials || {};
  const rates = data.rates || {};

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Claims Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Claims</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalClaimsInPeriod || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Total Paid</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(financials.totalPaid)}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Total Billed</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(financials.totalBilled)}</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Denial Rate</p>
          <p className="text-lg font-bold text-red-700">{rates.denialRate || 0}%</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders care management summary preview.
 */
function renderCareManagementPreview(data) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Care Management Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Events</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalCareEventsInPeriod || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Members Served</p>
          <p className="text-lg font-bold text-green-700">{data.uniqueMembersServed || 0}</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-[10px] text-purple-500 uppercase tracking-wider font-semibold">Avg Events/Member</p>
          <p className="text-lg font-bold text-purple-700">{data.averageEventsPerMember || 0}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders provider network summary preview.
 */
function renderProviderNetworkPreview(data) {
  const networkAdequacy = data.networkAdequacy || {};

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider Network Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Providers</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalProviders || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">In-Network</p>
          <p className="text-lg font-bold text-green-700">{data.inNetworkCount || 0}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">In-Network %</p>
          <p className="text-lg font-bold text-blue-700">{networkAdequacy.inNetworkPercentage || 0}%</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Accepting %</p>
          <p className="text-lg font-bold text-yellow-700">{networkAdequacy.acceptingPercentage || 0}%</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders financial summary preview.
 */
function renderFinancialSummaryPreview(data) {
  const claimFinancials = data.claimFinancials || {};
  const premiumRevenue = data.premiumRevenue || {};

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Financial Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Billed</p>
          <p className="text-sm font-bold text-csnp-primary">{formatCurrency(claimFinancials.totalBilled)}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Total Paid</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(claimFinancials.totalPaid)}</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Member Resp.</p>
          <p className="text-sm font-bold text-yellow-700">{formatCurrency(claimFinancials.totalMemberResponsibility)}</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-[10px] text-purple-500 uppercase tracking-wider font-semibold">MLR</p>
          <p className="text-lg font-bold text-purple-700">{data.medicalLossRatio || 0}%</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders quality measures preview.
 */
function renderQualityMeasuresPreview(data) {
  const populationMetrics = data.populationMetrics || {};
  const qualityIndicators = data.qualityIndicators || {};

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quality Measures</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Active Members</p>
          <p className="text-lg font-bold text-csnp-primary">{populationMetrics.totalActiveMembers || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">CM Engagement</p>
          <p className="text-lg font-bold text-green-700">{qualityIndicators.careManagementEngagementRate || 0}%</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Utilization</p>
          <p className="text-lg font-bold text-blue-700">{qualityIndicators.claimsUtilizationRate || 0}%</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Denial Rate</p>
          <p className="text-lg font-bold text-red-700">{qualityIndicators.claimDenialRate || 0}%</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders compliance audit preview.
 */
function renderComplianceAuditPreview(data) {
  const integrity = data.auditTrailIntegrity || {};

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compliance Audit</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Audit Entries</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalAuditEntries || 0}</p>
        </div>
        <div className={`p-3 rounded-lg border ${integrity.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${integrity.valid ? 'text-green-500' : 'text-red-500'}`}>Integrity</p>
          <p className={`text-lg font-bold ${integrity.valid ? 'text-green-700' : 'text-red-700'}`}>
            {integrity.valid ? 'Valid' : 'Failed'}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Checked</p>
          <p className="text-lg font-bold text-gray-700">{integrity.checkedEntries || 0}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders eligibility summary preview.
 */
function renderEligibilitySummaryPreview(data) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Eligibility Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Validations</p>
          <p className="text-lg font-bold text-csnp-primary">{data.totalValidationsInPeriod || 0}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Eligible</p>
          <p className="text-lg font-bold text-green-700">{data.eligibleCount || 0}</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Ineligible</p>
          <p className="text-lg font-bold text-red-700">{data.ineligibleCount || 0}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Eligibility Rate</p>
          <p className="text-lg font-bold text-blue-700">{data.eligibilityRate || 0}%</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders generic report data preview.
 */
function renderGenericPreview(data) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Data</p>
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <pre className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-64">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

ReportPreview.propTypes = {
  result: PropTypes.shape({
    success: PropTypes.bool,
    reportId: PropTypes.string,
    reportType: PropTypes.string,
    reportTypeLabel: PropTypes.string,
    reportData: PropTypes.object,
    auditId: PropTypes.string,
    timestamp: PropTypes.string,
    error: PropTypes.string,
  }),
  onDownloadJSON: PropTypes.func.isRequired,
  onDownloadCSV: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

ReportPreview.defaultProps = {
  result: null,
};

/**
 * Report history item component.
 *
 * @param {Object} props
 * @param {Object} props.report - The report record
 * @param {Function} props.onView - View handler
 * @param {Function} props.onDownload - Download handler
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function ReportHistoryItem({ report, onView, onDownload, isLast = false }) {
  const reportTypeLabel = report.reportTypeLabel || CMS_REPORT_TYPE_LABELS[report.reportType] || toTitleCase(report.reportType || 'unknown');

  return (
    <div className={`flex items-start gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
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
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={reportTypeLabel}>
            {reportTypeLabel}
          </p>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2" title={formatDateTime(report.generatedAt || report.createdAt)}>
            {formatRelativeTime(report.generatedAt || report.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
          {report.dateRange && (
            <span>
              {report.dateRange.startDate ? formatDate(report.dateRange.startDate) : '—'} – {report.dateRange.endDate ? formatDate(report.dateRange.endDate) : '—'}
            </span>
          )}
          {report.generatedBy && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>By: {report.generatedBy.substring(0, 8)}…</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <button
            type="button"
            onClick={() => onView(report)}
            className="text-[10px] font-medium text-csnp-primary hover:text-csnp-primary-dark focus:outline-none transition-colors duration-150"
          >
            View
          </button>
          <span className="text-gray-300" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onDownload(report)}
            className="text-[10px] font-medium text-csnp-primary hover:text-csnp-primary-dark focus:outline-none transition-colors duration-150"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

ReportHistoryItem.propTypes = {
  report: PropTypes.shape({
    id: PropTypes.string,
    reportType: PropTypes.string,
    reportTypeLabel: PropTypes.string,
    dateRange: PropTypes.shape({
      startDate: PropTypes.string,
      endDate: PropTypes.string,
    }),
    generatedBy: PropTypes.string,
    generatedAt: PropTypes.string,
    createdAt: PropTypes.string,
    reportData: PropTypes.object,
  }).isRequired,
  onView: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  isLast: PropTypes.bool,
};

ReportHistoryItem.defaultProps = {
  isLast: false,
};

/**
 * Report detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.report - The report to display
 * @param {Function} props.onDownload - Download handler
 * @returns {React.ReactElement|null}
 */
function ReportDetailModal({ isOpen, onClose, report, onDownload }) {
  if (!report) {
    return null;
  }

  const reportTypeLabel = report.reportTypeLabel || CMS_REPORT_TYPE_LABELS[report.reportType] || toTitleCase(report.reportType || 'unknown');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Report Info */}
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-csnp-primary">{reportTypeLabel}</span>
            <span className="text-xs text-gray-500">
              {report.generatedAt ? formatRelativeTime(report.generatedAt) : report.createdAt ? formatRelativeTime(report.createdAt) : ''}
            </span>
          </div>
        </div>

        {/* Report Metadata Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Report ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={report.id}>
              {report.id ? report.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Report Type</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">{reportTypeLabel}</p>
          </div>
          {report.dateRange && (
            <>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Start Date</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {report.dateRange.startDate ? formatDate(report.dateRange.startDate) : '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">End Date</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {report.dateRange.endDate ? formatDate(report.dateRange.endDate) : '—'}
                </p>
              </div>
            </>
          )}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Generated By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {report.generatedBy ? report.generatedBy.substring(0, 12) + '…' : 'System'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Generated At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {report.generatedAt ? formatDateTime(report.generatedAt) : report.createdAt ? formatDateTime(report.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Report Data Preview */}
        {report.reportData && renderReportDataPreview(report.reportData, report.reportType)}

        {/* Raw Data */}
        {report.reportData && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raw Data</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <pre className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-48">
                {JSON.stringify(report.reportData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onDownload(report)}
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
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ReportDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  report: PropTypes.object,
  onDownload: PropTypes.func.isRequired,
};

ReportDetailModal.defaultProps = {
  report: null,
};

/**
 * Skeleton loading state for the report generator.
 * @returns {React.ReactElement}
 */
function CMSReportGeneratorSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-32 bg-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * CMS report generation component.
 * Provides report type selection (enrollment extract, compliance data, weekly audit),
 * date range picker, generation action, report preview, and download options.
 * Calls complianceService.generateCMSReport on submission.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showReportTypeCards=true] - Whether to show report type cards (vs select dropdown)
 * @param {boolean} [props.showHistory=true] - Whether to show report generation history
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {string} [props.initialReportType=''] - Pre-selected report type
 * @param {Function} [props.onReportGenerated] - Callback when report is generated: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function CMSReportGenerator({
  showHeader = true,
  showReportTypeCards = true,
  showHistory = true,
  compact = false,
  initialReportType = '',
  onReportGenerated,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Form state
  const [reportType, setReportType] = useState(initialReportType);
  const [dateRangePreset, setDateRangePreset] = useState('last_30_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI state
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // History state
  const [reportHistory, setReportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  /**
   * Initializes date range from default preset.
   */
  useEffect(() => {
    const preset = DATE_RANGE_PRESETS.find((p) => p.value === 'last_30_days');
    if (preset) {
      const range = preset.getRange();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }, []);

  /**
   * Loads report history.
   */
  const loadHistory = useCallback(() => {
    if (!showHistory) {
      return;
    }

    setHistoryLoading(true);

    try {
      const reports = getComplianceReports();
      setReportHistory(Array.isArray(reports) ? reports.slice(0, 20) : []);
    } catch (err) {
      console.error('CMSReportGenerator: failed to load report history:', err);
      setReportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [showHistory]);

  /**
   * Initial history load.
   */
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Handles date range preset change.
   * @param {string} presetValue - The preset value
   */
  const handlePresetChange = useCallback((presetValue) => {
    setDateRangePreset(presetValue);

    const preset = DATE_RANGE_PRESETS.find((p) => p.value === presetValue);
    if (preset) {
      const range = preset.getRange();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }

    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated.startDate;
      delete updated.endDate;
      return updated;
    });
  }, []);

  /**
   * Handles report type selection.
   * @param {string} type - The report type value
   */
  const handleSelectReportType = useCallback((type) => {
    setReportType(type);
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated.reportType;
      return updated;
    });
  }, []);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!reportType || reportType.trim().length === 0) {
      errors.reportType = 'Please select a report type';
    }

    if (!startDate || startDate.trim().length === 0) {
      errors.startDate = 'Start date is required';
    }

    if (!endDate || endDate.trim().length === 0) {
      errors.endDate = 'End date is required';
    }

    if (startDate && endDate) {
      try {
        const start = new Date(startDate.trim() + 'T00:00:00');
        const end = new Date(endDate.trim() + 'T00:00:00');
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start.getTime() > end.getTime()) {
          errors.endDate = 'End date must be after start date';
        }
      } catch {
        // Ignore date parsing errors
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [reportType, startDate, endDate]);

  /**
   * Handles form submission.
   * @param {React.FormEvent} e - Form event
   */
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setGenerating(true);
      setFormError(null);
      setGenerationResult(null);

      try {
        const performedBy = user ? user.id : 'system';

        const result = generateCMSReport(
          reportType.trim(),
          {
            startDate: startDate.trim(),
            endDate: endDate.trim(),
          },
          { performedBy }
        );

        setGenerationResult(result);

        if (result.success) {
          addNotification(
            'success',
            'Report Generated',
            `${result.reportTypeLabel || CMS_REPORT_TYPE_LABELS[reportType] || reportType} has been generated successfully.`
          );

          loadHistory();

          if (typeof onReportGenerated === 'function') {
            onReportGenerated(result);
          }
        } else {
          addNotification(
            'error',
            'Report Generation Failed',
            result.error || 'An error occurred while generating the CMS report.'
          );
          setFormError(result.error || 'An error occurred while generating the CMS report.');
        }
      } catch (err) {
        console.error('CMSReportGenerator: generation error:', err);
        setFormError('An unexpected error occurred while generating the CMS report.');
        addNotification('error', 'Generation Error', 'An unexpected error occurred.');
      } finally {
        setGenerating(false);
      }
    },
    [validateForm, user, reportType, startDate, endDate, addNotification, loadHistory, onReportGenerated]
  );

  /**
   * Handles form reset / dismiss result.
   */
  const handleReset = useCallback(() => {
    setReportType(initialReportType);
    setDateRangePreset('last_30_days');
    const preset = DATE_RANGE_PRESETS.find((p) => p.value === 'last_30_days');
    if (preset) {
      const range = preset.getRange();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
    setGenerationResult(null);
    setFormError(null);
    setFormErrors({});
  }, [initialReportType]);

  /**
   * Handles downloading the generated report as JSON.
   */
  const handleDownloadJSON = useCallback(() => {
    if (!generationResult || !generationResult.success || !generationResult.reportData) {
      addNotification('warning', 'No Data', 'No report data available for download.');
      return;
    }

    try {
      const payload = {
        reportType: generationResult.reportType,
        reportTypeLabel: generationResult.reportTypeLabel,
        reportId: generationResult.reportId,
        generatedAt: generationResult.timestamp,
        reportData: generationResult.reportData,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `cms_report_${generationResult.reportType}_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Download Complete', 'Report downloaded as JSON.');
    } catch (err) {
      console.error('CMSReportGenerator: JSON download failed:', err);
      addNotification('error', 'Download Failed', 'An error occurred while downloading the report.');
    }
  }, [generationResult, addNotification]);

  /**
   * Handles downloading the generated report as CSV.
   */
  const handleDownloadCSV = useCallback(() => {
    if (!generationResult || !generationResult.success || !generationResult.reportData) {
      addNotification('warning', 'No Data', 'No report data available for download.');
      return;
    }

    try {
      const csv = buildReportCSV(generationResult.reportData, generationResult.reportType);
      const filename = `cms_report_${generationResult.reportType}_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Download Complete', 'Report downloaded as CSV.');
    } catch (err) {
      console.error('CMSReportGenerator: CSV download failed:', err);
      addNotification('error', 'Download Failed', 'An error occurred while downloading the report.');
    }
  }, [generationResult, addNotification]);

  /**
   * Handles downloading a historical report as JSON.
   * @param {Object} report - The report record
   */
  const handleDownloadHistoricalReport = useCallback((report) => {
    if (!report || !report.reportData) {
      addNotification('warning', 'No Data', 'No report data available for download.');
      return;
    }

    try {
      const payload = {
        reportType: report.reportType,
        reportTypeLabel: report.reportTypeLabel,
        reportId: report.id,
        generatedAt: report.generatedAt || report.createdAt,
        dateRange: report.dateRange,
        reportData: report.reportData,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `cms_report_${report.reportType}_${report.id ? report.id.substring(0, 8) : 'unknown'}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Download Complete', 'Report downloaded as JSON.');
    } catch (err) {
      console.error('CMSReportGenerator: historical download failed:', err);
      addNotification('error', 'Download Failed', 'An error occurred while downloading the report.');
    }
  }, [addNotification]);

  /**
   * Handles viewing a historical report.
   * @param {Object} report - The report record
   */
  const handleViewHistoricalReport = useCallback((report) => {
    setSelectedReport(report);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedReport(null);
  }, []);

  /**
   * Computed: selected report type option.
   */
  const selectedReportOption = useMemo(() => {
    if (!reportType) {
      return null;
    }
    return REPORT_TYPE_OPTIONS.find((opt) => opt.value === reportType) || null;
  }, [reportType]);

  /**
   * Computed: whether the form can be submitted.
   */
  const canSubmit = useMemo(() => {
    return (
      typeof reportType === 'string' &&
      reportType.trim().length > 0 &&
      typeof startDate === 'string' &&
      startDate.trim().length > 0 &&
      typeof endDate === 'string' &&
      endDate.trim().length > 0 &&
      !generating
    );
  }, [reportType, startDate, endDate, generating]);

  /**
   * Computed: report history stats.
   */
  const historyStats = useMemo(() => {
    const byType = {};
    for (const report of reportHistory) {
      const type = report.reportType || 'unknown';
      if (!byType[type]) {
        byType[type] = 0;
      }
      byType[type]++;
    }
    return {
      total: reportHistory.length,
      byType,
    };
  }, [reportHistory]);

  const containerClassName = [className].filter(Boolean).join(' ');

  /**
   * Renders the Generate tab content.
   */
  function renderGenerateTab() {
    return (
      <div className="space-y-6">
        {/* Form Error */}
        {formError && !generationResult && (
          <Alert
            variant="error"
            title="Error"
            dismissible={true}
            onDismiss={() => setFormError(null)}
          >
            {formError}
          </Alert>
        )}

        {/* Generation Result */}
        {generationResult && (
          <ReportPreview
            result={generationResult}
            onDownloadJSON={handleDownloadJSON}
            onDownloadCSV={handleDownloadCSV}
            onDismiss={handleReset}
          />
        )}

        {/* Form */}
        {!generationResult && (
          <form onSubmit={handleSubmit} noValidate>
            {/* Section 1: Report Type Selection */}
            <Card bordered={true} flat={false} className="mb-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-csnp-primary">Report Type</p>
                  {reportType && selectedReportOption && (
                    <span className="text-[10px] font-medium text-csnp-primary bg-csnp-blue-50 px-2 py-0.5 rounded-full border border-csnp-blue-100">
                      {selectedReportOption.label}
                    </span>
                  )}
                </div>

                {formErrors.reportType && (
                  <p className="text-xs text-csnp-alert-error" role="alert">
                    {formErrors.reportType}
                  </p>
                )}

                {showReportTypeCards && !compact ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {REPORT_TYPE_OPTIONS.map((option) => (
                      <ReportTypeCard
                        key={option.value}
                        reportOption={option}
                        selected={reportType === option.value}
                        onSelect={handleSelectReportType}
                        disabled={generating}
                      />
                    ))}
                  </div>
                ) : (
                  <FormField
                    name="reportType"
                    label="Report Type"
                    type="select"
                    value={reportType}
                    onChange={(e) => handleSelectReportType(e.target.value)}
                    options={REPORT_TYPE_SELECT_OPTIONS}
                    required={true}
                    disabled={generating}
                    error={formErrors.reportType}
                    placeholder="Select report type..."
                  />
                )}
              </div>
            </Card>

            {/* Section 2: Date Range */}
            <Card bordered={true} flat={false} className="mb-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-csnp-primary">Date Range</p>

                <p className="text-xs text-gray-500">
                  Select the reporting period for the CMS report. Use a preset or specify custom dates.
                </p>

                {/* Date Range Presets */}
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handlePresetChange(preset.value)}
                      disabled={generating}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
                        dateRangePreset === preset.value
                          ? 'bg-csnp-primary text-white border-csnp-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-csnp-primary-light hover:text-csnp-primary'
                      } ${generating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    name="startDate"
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateRangePreset('custom');
                      setFormErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.startDate;
                        return updated;
                      });
                    }}
                    required={true}
                    disabled={generating}
                    error={formErrors.startDate}
                    helperText="Start of the reporting period"
                  />

                  <FormField
                    name="endDate"
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateRangePreset('custom');
                      setFormErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.endDate;
                        return updated;
                      });
                    }}
                    required={true}
                    disabled={generating}
                    error={formErrors.endDate}
                    helperText="End of the reporting period"
                  />
                </div>

                {/* Date Range Display */}
                {startDate && endDate && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>
                      Reporting period: {formatDate(startDate)} – {formatDate(endDate)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Report Summary */}
            {reportType && startDate && endDate && (
              <Card bordered={true} flat={false} className="mb-6" variant="primary">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-csnp-primary">Report Summary</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Report Type</p>
                      <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                        {selectedReportOption ? selectedReportOption.label : reportType}
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Start Date</p>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">
                        {formatDate(startDate)}
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">End Date</p>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">
                        {formatDate(endDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* CMS Compliance Notice */}
            {!compact && (
              <div className="mb-6">
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
                    CMS reports are generated per regulatory requirements for Chronic Condition Special Needs Plans
                    (42 CFR §422.4). All report generation activities are logged in the audit trail. Reports should
                    be generated regularly for compliance monitoring and submitted to CMS as required by the plan&apos;s
                    reporting schedule.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={generating}
                  loadingText="Generating..."
                  disabled={!canSubmit}
                  iconLeft={
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
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  }
                >
                  Generate Report
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleReset}
                  disabled={generating}
                >
                  Reset
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                {reportType && (
                  <>
                    <span>{CMS_REPORT_TYPE_LABELS[reportType] ? CMS_REPORT_TYPE_LABELS[reportType].split(' ').slice(0, 2).join(' ') : reportType}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                  </>
                )}
                {startDate && endDate && (
                  <span>{formatDate(startDate)} – {formatDate(endDate)}</span>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  /**
   * Renders the History tab content.
   */
  function renderHistoryTab() {
    if (historyLoading) {
      return (
        <LoadingSpinner
          size="sm"
          variant="primary"
          text="Loading report history..."
        />
      );
    }

    if (reportHistory.length === 0) {
      return (
        <EmptyState
          title="No Report History"
          description="No CMS reports have been generated yet. Generate a report to see it here."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recent Reports ({reportHistory.length})
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadHistory}
            disabled={historyLoading}
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

        {/* History Stats */}
        {!compact && historyStats.total > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
              <span className="text-[10px] font-medium text-csnp-primary">
                {historyStats.total} total
              </span>
            </div>
            {Object.entries(historyStats.byType).slice(0, 4).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                <span className="text-[10px] font-medium text-gray-600">
                  {(CMS_REPORT_TYPE_LABELS[type] || toTitleCase(type)).split(' ').slice(0, 2).join(' ')}: {count}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* History List */}
        <div>
          {reportHistory.map((report, index) => (
            <ReportHistoryItem
              key={report.id || `history-${index}`}
              report={report}
              onView={handleViewHistoricalReport}
              onDownload={handleDownloadHistoricalReport}
              isLast={index === reportHistory.length - 1}
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
        key: 'generate',
        label: 'Generate Report',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        ),
        content: renderGenerateTab(),
      },
    ];

    if (showHistory) {
      tabList.push({
        key: 'history',
        label: 'Report History',
        badge: reportHistory.length > 0 ? String(reportHistory.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: renderHistoryTab(),
      });
    }

    return tabList;
  }, [reportType, startDate, endDate, generating, generationResult, formError, formErrors, reportHistory, historyLoading, showHistory, showReportTypeCards, compact, dateRangePreset, selectedReportOption, canSubmit, historyStats]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
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
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                CMS Report Generator
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Generate CMS compliance reports for enrollment, claims, care management, provider network,
                  eligibility, financial, and quality measures data.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        defaultActiveKey="generate"
        variant="underline"
        size="sm"
      />

      {/* Report Detail Modal */}
      <ReportDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        report={selectedReport}
        onDownload={handleDownloadHistoricalReport}
      />
    </div>
  );
}

CMSReportGenerator.propTypes = {
  showHeader: PropTypes.bool,
  showReportTypeCards: PropTypes.bool,
  showHistory: PropTypes.bool,
  compact: PropTypes.bool,
  initialReportType: PropTypes.string,
  onReportGenerated: PropTypes.func,
  className: PropTypes.string,
};

CMSReportGenerator.defaultProps = {
  showHeader: true,
  showReportTypeCards: true,
  showHistory: true,
  compact: false,
  initialReportType: '',
  onReportGenerated: undefined,
  className: '',
};