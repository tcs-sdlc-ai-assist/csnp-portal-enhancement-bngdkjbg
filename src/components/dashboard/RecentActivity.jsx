import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuditTrail } from '../../hooks/useAuditTrail.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { formatRelativeTime, formatDateTime, toTitleCase } from '../../utils/helpers.js';
import { AUDIT_ACTIONS } from '../../utils/constants.js';

/**
 * Action type to icon path mapping for activity feed items.
 * @type {Object.<string, string>}
 */
const ACTION_ICONS = {
  [AUDIT_ACTIONS.LOGIN]: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
  [AUDIT_ACTIONS.LOGOUT]: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  [AUDIT_ACTIONS.CREATE]: 'M12 4v16m8-8H4',
  [AUDIT_ACTIONS.UPDATE]: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  [AUDIT_ACTIONS.DELETE]: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  [AUDIT_ACTIONS.APPROVE]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  [AUDIT_ACTIONS.DENY]: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  [AUDIT_ACTIONS.SUBMIT]: 'M9 5l7 7-7 7',
  [AUDIT_ACTIONS.ENROLL]: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  [AUDIT_ACTIONS.DISENROLL]: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6',
  [AUDIT_ACTIONS.CLAIM_SUBMIT]: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  [AUDIT_ACTIONS.CLAIM_APPROVE]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  [AUDIT_ACTIONS.CLAIM_DENY]: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  [AUDIT_ACTIONS.CLAIM_APPEAL]: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  [AUDIT_ACTIONS.REFERRAL_CREATE]: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  [AUDIT_ACTIONS.REFERRAL_UPDATE]: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  [AUDIT_ACTIONS.CARE_PLAN_CREATE]: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  [AUDIT_ACTIONS.CARE_PLAN_UPDATE]: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  [AUDIT_ACTIONS.EXPORT]: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  [AUDIT_ACTIONS.IMPORT]: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
};

/**
 * Action type to color class mapping for activity feed icons.
 * @type {Object.<string, { bg: string, text: string }>}
 */
const ACTION_COLORS = {
  [AUDIT_ACTIONS.LOGIN]: { bg: 'bg-blue-50', text: 'text-blue-600' },
  [AUDIT_ACTIONS.LOGOUT]: { bg: 'bg-gray-50', text: 'text-gray-500' },
  [AUDIT_ACTIONS.CREATE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.UPDATE]: { bg: 'bg-csnp-blue-50', text: 'text-csnp-primary' },
  [AUDIT_ACTIONS.DELETE]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.APPROVE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.DENY]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.SUBMIT]: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  [AUDIT_ACTIONS.ENROLL]: { bg: 'bg-csnp-green-50', text: 'text-csnp-secondary' },
  [AUDIT_ACTIONS.DISENROLL]: { bg: 'bg-orange-50', text: 'text-orange-600' },
  [AUDIT_ACTIONS.CLAIM_SUBMIT]: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  [AUDIT_ACTIONS.CLAIM_APPROVE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.CLAIM_DENY]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.CLAIM_APPEAL]: { bg: 'bg-amber-50', text: 'text-amber-600' },
  [AUDIT_ACTIONS.REFERRAL_CREATE]: { bg: 'bg-purple-50', text: 'text-purple-600' },
  [AUDIT_ACTIONS.REFERRAL_UPDATE]: { bg: 'bg-purple-50', text: 'text-purple-600' },
  [AUDIT_ACTIONS.CARE_PLAN_CREATE]: { bg: 'bg-pink-50', text: 'text-pink-600' },
  [AUDIT_ACTIONS.CARE_PLAN_UPDATE]: { bg: 'bg-pink-50', text: 'text-pink-600' },
  [AUDIT_ACTIONS.EXPORT]: { bg: 'bg-teal-50', text: 'text-teal-600' },
  [AUDIT_ACTIONS.IMPORT]: { bg: 'bg-teal-50', text: 'text-teal-600' },
};

/**
 * Default icon color for unrecognized action types.
 * @type {{ bg: string, text: string }}
 */
const DEFAULT_ACTION_COLOR = { bg: 'bg-gray-50', text: 'text-gray-500' };

/**
 * Default icon path for unrecognized action types.
 * @type {string}
 */
const DEFAULT_ICON_PATH = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

/**
 * Module badge color mapping.
 * @type {Object.<string, string>}
 */
const MODULE_BADGE_STATUSES = {
  auth: 'submitted',
  eligibility: 'eligible',
  enrollment: 'active',
  benefits: 'approved',
  claims: 'processing',
  provider: 'accepted',
  care_management: 'in_progress',
  compliance: 'compliant',
  integration: 'pending',
  ruleEngine: 'in_review',
  general: 'pending',
};

/**
 * Retrieves the user display name from a user ID.
 * Attempts to find the user in the seed data users collection.
 * @param {string} userId - The user ID
 * @param {Object[]} users - Array of user objects from localStorage
 * @returns {string} The user display name or a truncated user ID
 */
function getUserDisplayName(userId, users) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return 'System';
  }

  if (userId === 'system' || userId === 'unknown') {
    return userId === 'system' ? 'System' : 'Unknown';
  }

  if (Array.isArray(users)) {
    const user = users.find((u) => u.id === userId);
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || userId.substring(0, 8);
    }
  }

  return userId.substring(0, 8) + '…';
}

/**
 * Returns the SVG icon path for a given action type.
 * @param {string} action - The audit action type
 * @returns {string} SVG path data
 */
function getActionIconPath(action) {
  return ACTION_ICONS[action] || DEFAULT_ICON_PATH;
}

/**
 * Returns the color classes for a given action type.
 * @param {string} action - The audit action type
 * @returns {{ bg: string, text: string }}
 */
function getActionColors(action) {
  return ACTION_COLORS[action] || DEFAULT_ACTION_COLOR;
}

/**
 * Returns the module badge status string for StatusBadge component.
 * @param {string} module - The module name
 * @returns {string} Status string for StatusBadge
 */
function getModuleBadgeStatus(module) {
  if (typeof module !== 'string' || module.trim().length === 0) {
    return 'pending';
  }
  return MODULE_BADGE_STATUSES[module.trim()] || 'pending';
}

/**
 * Formats a module name for display.
 * @param {string} module - The module name
 * @returns {string} Formatted module name
 */
function formatModuleName(module) {
  if (typeof module !== 'string' || module.trim().length === 0) {
    return 'General';
  }
  return toTitleCase(module.trim());
}

/**
 * Skeleton loading row for the activity feed.
 * @returns {React.ReactElement}
 */
function ActivitySkeleton() {
  return (
    <div className="animate-pulse flex items-start space-x-3 py-3">
      <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-2 bg-gray-200 rounded w-1/4" />
      </div>
    </div>
  );
}

/**
 * Single activity feed item component.
 *
 * @param {Object} props
 * @param {Object} props.entry - The audit log entry
 * @param {Object[]} props.users - Array of user objects for name resolution
 * @param {boolean} [props.showModule=true] - Whether to show the module badge
 * @param {boolean} [props.isLast=false] - Whether this is the last item (no bottom border)
 * @returns {React.ReactElement}
 */
function ActivityItem({ entry, users, showModule = true, isLast = false }) {
  const actionColors = getActionColors(entry.action);
  const iconPath = getActionIconPath(entry.action);
  const userName = getUserDisplayName(entry.userId, users);
  const moduleName = formatModuleName(entry.module);
  const moduleBadgeStatus = getModuleBadgeStatus(entry.module);
  const relativeTime = formatRelativeTime(entry.timestamp);
  const fullDateTime = formatDateTime(entry.timestamp);
  const actionLabel = toTitleCase(entry.action || 'unknown');

  const description = entry.description && typeof entry.description === 'string' && entry.description.trim().length > 0
    ? entry.description
    : `${actionLabel} action performed`;

  const truncatedDescription = description.length > 120
    ? description.substring(0, 120).trimEnd() + '…'
    : description;

  return (
    <div
      className={`flex items-start space-x-3 py-3 ${
        !isLast ? 'border-b border-gray-100' : ''
      }`}
    >
      {/* Action Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${actionColors.bg} ${actionColors.text}`}
      >
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
          <path d={iconPath} />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header: User name and action */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-900 truncate max-w-[140px]">
            {userName}
          </span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs font-medium text-csnp-primary-light">
            {actionLabel}
          </span>
          {showModule && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <StatusBadge
                status={moduleBadgeStatus}
                label={moduleName}
                size="sm"
                showDot={false}
                bordered={false}
              />
            </>
          )}
        </div>

        {/* Description */}
        <p className="mt-0.5 text-xs text-gray-600 leading-relaxed line-clamp-2">
          {truncatedDescription}
        </p>

        {/* Timestamp */}
        <p
          className="mt-1 text-[10px] text-gray-400"
          title={fullDateTime}
        >
          {relativeTime}
        </p>
      </div>
    </div>
  );
}

ActivityItem.propTypes = {
  entry: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
    userId: PropTypes.string,
    description: PropTypes.string,
    module: PropTypes.string,
    timestamp: PropTypes.string,
    targetType: PropTypes.string,
    targetId: PropTypes.string,
    metadata: PropTypes.object,
  }).isRequired,
  users: PropTypes.arrayOf(PropTypes.object),
  showModule: PropTypes.bool,
  isLast: PropTypes.bool,
};

ActivityItem.defaultProps = {
  users: [],
  showModule: true,
  isLast: false,
};

/**
 * Dashboard recent activity feed component.
 * Displays the latest audit log entries with timestamps, user names,
 * action descriptions, and module badges. Supports configurable
 * entry count, auto-refresh, and filtering by module.
 *
 * @param {Object} props
 * @param {number} [props.maxEntries=10] - Maximum number of entries to display
 * @param {boolean} [props.showModule=true] - Whether to show module badges
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Recent Activity'] - Section title
 * @param {string} [props.filterModule] - Optional module filter
 * @param {string} [props.filterAction] - Optional action type filter
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function RecentActivity({
  maxEntries = 10,
  showModule = true,
  showHeader = true,
  title = 'Recent Activity',
  filterModule,
  filterAction,
  refreshInterval = 0,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { logs, loading, error, fetchLogs } = useAuditTrail();
  const [users, setUsers] = useState([]);

  /**
   * Loads users from localStorage for name resolution.
   */
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem('csnp_users');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed);
        }
      }
    } catch {
      // Silently fail — user names will fall back to truncated IDs
    }
  }, []);

  /**
   * Fetches audit logs with optional filters.
   */
  const loadActivity = useCallback(() => {
    const filters = {};

    if (typeof filterModule === 'string' && filterModule.trim().length > 0) {
      filters.module = filterModule.trim();
    }

    if (typeof filterAction === 'string' && filterAction.trim().length > 0) {
      filters.action = filterAction.trim();
    }

    fetchLogs(filters);
  }, [fetchLogs, filterModule, filterAction]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  /**
   * Auto-refresh interval.
   */
  useEffect(() => {
    if (typeof refreshInterval !== 'number' || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      loadActivity();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval, loadActivity]);

  /**
   * Sliced entries limited to maxEntries.
   * @type {Object[]}
   */
  const displayEntries = useMemo(() => {
    if (!Array.isArray(logs)) {
      return [];
    }

    const safeMax = typeof maxEntries === 'number' && maxEntries > 0 ? maxEntries : 10;
    return logs.slice(0, safeMax);
  }, [logs, maxEntries]);

  const hasEntries = displayEntries.length > 0;
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
            {/* Activity icon */}
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
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            {hasTitle && (
              <h3 className="text-sm font-semibold text-csnp-primary">
                {title}
              </h3>
            )}
            {hasEntries && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {displayEntries.length}
              </span>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-5 py-2">
        {/* Loading State */}
        {loading && !hasEntries && (
          <div className="py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ActivitySkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && !hasEntries && (
          <div className="py-4">
            <EmptyState
              title="Unable to load activity"
              description={error}
              iconType="error"
              size="sm"
              actionLabel="Retry"
              onAction={loadActivity}
              actionVariant="outline"
            />
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasEntries && (
          <div className="py-4">
            <EmptyState
              title="No recent activity"
              description="Activity will appear here as actions are performed in the portal."
              iconType="no-data"
              size="sm"
            />
          </div>
        )}

        {/* Activity Feed */}
        {hasEntries && (
          <div>
            {displayEntries.map((entry, index) => (
              <ActivityItem
                key={entry.id || `activity-${index}`}
                entry={entry}
                users={users}
                showModule={showModule}
                isLast={index === displayEntries.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasEntries && logs.length > displayEntries.length && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Showing {displayEntries.length} of {logs.length} entries
          </p>
        </div>
      )}
    </div>
  );
}

RecentActivity.propTypes = {
  maxEntries: PropTypes.number,
  showModule: PropTypes.bool,
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  filterModule: PropTypes.string,
  filterAction: PropTypes.string,
  refreshInterval: PropTypes.number,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

RecentActivity.defaultProps = {
  maxEntries: 10,
  showModule: true,
  showHeader: true,
  title: 'Recent Activity',
  filterModule: undefined,
  filterAction: undefined,
  refreshInterval: 0,
  className: '',
  headerActions: null,
};