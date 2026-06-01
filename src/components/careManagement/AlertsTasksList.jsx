import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import DataTable from '../common/DataTable.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  getMemberAlerts,
  getMemberTasks,
  getCareManagerAlerts,
  getCareManagerTasks,
  acknowledgeAlert,
  completeTask,
  getCareManagementStats,
} from '../../services/careManagementService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
} from '../../utils/helpers.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Alert severity to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string }>}
 */
const ALERT_SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

/**
 * Default alert severity style.
 * @type {{ bg: string, text: string, border: string, dot: string }}
 */
const DEFAULT_ALERT_SEVERITY_STYLE = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };

/**
 * Task priority to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string }>}
 */
const TASK_PRIORITY_STYLES = {
  urgent: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  low: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
};

/**
 * Default task priority style.
 * @type {{ bg: string, text: string, border: string, dot: string }}
 */
const DEFAULT_TASK_PRIORITY_STYLE = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };

/**
 * Severity filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const SEVERITY_FILTER_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/**
 * Priority filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/**
 * Task status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const TASK_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Alert status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const ALERT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unacknowledged', label: 'Unacknowledged' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

/**
 * Skeleton loading state for the alerts/tasks list.
 * @returns {React.ReactElement}
 */
function AlertsTasksListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Single alert item component.
 *
 * @param {Object} props
 * @param {Object} props.alert - The alert object
 * @param {Function} props.onAcknowledge - Acknowledge handler
 * @param {Function} props.onSnooze - Snooze handler
 * @param {Function} props.onViewDetails - View details handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function AlertItem({ alert, onAcknowledge, onSnooze, onViewDetails, disabled = false }) {
  const severityStyle = ALERT_SEVERITY_STYLES[alert.severity] || DEFAULT_ALERT_SEVERITY_STYLE;
  const isAcknowledged = alert.acknowledged === true;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      isAcknowledged ? 'bg-gray-50 border-gray-200 opacity-60' : `${severityStyle.bg} ${severityStyle.border}`
    }`}>
      {/* Severity Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isAcknowledged ? 'bg-gray-200 text-gray-400' : `${severityStyle.bg} ${severityStyle.text}`
      }`}>
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
      </div>

      {/* Alert Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-semibold ${isAcknowledged ? 'text-gray-500' : 'text-gray-900'}`}>
            {alert.title || 'Alert'}
          </p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityStyle.dot}`} aria-hidden="true" />
            {toTitleCase(alert.severity || 'medium')}
          </span>
          {isAcknowledged && (
            <span className="text-[10px] text-gray-400 font-medium">Acknowledged</span>
          )}
        </div>
        {alert.description && (
          <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
            {alert.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
          <span>{formatRelativeTime(alert.createdAt)}</span>
          {alert.memberId && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="truncate max-w-[100px]" title={alert.memberId}>
                Member: {alert.memberId.substring(0, 8)}…
              </span>
            </>
          )}
          {alert.assignedTo && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="truncate max-w-[100px]" title={alert.assignedTo}>
                Assigned: {alert.assignedTo.substring(0, 8)}…
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* View Details */}
        <button
          type="button"
          onClick={() => onViewDetails(alert)}
          className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
          aria-label={`View details for alert "${alert.title}"`}
          title="View details"
        >
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        {/* Snooze */}
        {!disabled && !isAcknowledged && (
          <button
            type="button"
            onClick={() => onSnooze(alert.id)}
            className="p-1.5 rounded text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-300 transition-colors duration-150"
            aria-label={`Snooze alert "${alert.title}"`}
            title="Snooze"
          >
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        )}

        {/* Acknowledge */}
        {!disabled && !isAcknowledged && (
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="p-1.5 rounded text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
            aria-label={`Acknowledge alert "${alert.title}"`}
            title="Acknowledge"
          >
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
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

AlertItem.propTypes = {
  alert: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    severity: PropTypes.string,
    acknowledged: PropTypes.bool,
    memberId: PropTypes.string,
    assignedTo: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  onSnooze: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AlertItem.defaultProps = {
  disabled: false,
};

/**
 * Single task item component.
 *
 * @param {Object} props
 * @param {Object} props.task - The task object
 * @param {Function} props.onComplete - Complete handler
 * @param {Function} props.onSnooze - Snooze handler
 * @param {Function} props.onViewDetails - View details handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function TaskItem({ task, onComplete, onSnooze, onViewDetails, disabled = false }) {
  const priorityStyle = TASK_PRIORITY_STYLES[task.priority] || DEFAULT_TASK_PRIORITY_STYLE;
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && !isCompleted && !isCancelled && new Date(task.dueDate + 'T23:59:59').getTime() < Date.now();

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      isCompleted
        ? 'bg-green-50 border-green-200 opacity-60'
        : isCancelled
          ? 'bg-gray-50 border-gray-200 opacity-50'
          : isOverdue
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      {/* Priority Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isCompleted ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : `${priorityStyle.bg} ${priorityStyle.text}`
      }`}>
        {isCompleted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-semibold ${isCompleted ? 'text-green-700 line-through' : isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
            {task.title || 'Unnamed Task'}
          </p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
            {toTitleCase(task.priority || 'medium')}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
              OVERDUE
            </span>
          )}
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
            task.status === 'completed' ? 'bg-green-100 text-green-700' :
            task.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
            task.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {toTitleCase(task.status || 'pending')}
          </span>
        </div>

        {task.description && (
          <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
          {task.dueDate && (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due: {formatDate(task.dueDate)}
            </span>
          )}
          {task.category && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{toTitleCase(task.category)}</span>
            </>
          )}
          {task.memberId && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="truncate max-w-[100px]" title={task.memberId}>
                Member: {task.memberId.substring(0, 8)}…
              </span>
            </>
          )}
          {task.assignedTo && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="truncate max-w-[100px]" title={task.assignedTo}>
                Assigned: {task.assignedTo.substring(0, 8)}…
              </span>
            </>
          )}
          {task.completedAt && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="text-green-500">Completed {formatRelativeTime(task.completedAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* View Details */}
        <button
          type="button"
          onClick={() => onViewDetails(task)}
          className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
          aria-label={`View details for task "${task.title}"`}
          title="View details"
        >
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        {/* Snooze */}
        {!disabled && !isCompleted && !isCancelled && (
          <button
            type="button"
            onClick={() => onSnooze(task.id)}
            className="p-1.5 rounded text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-300 transition-colors duration-150"
            aria-label={`Snooze task "${task.title}"`}
            title="Snooze"
          >
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        )}

        {/* Complete */}
        {!disabled && !isCompleted && !isCancelled && (
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className="p-1.5 rounded text-green-500 hover:bg-green-50 hover:text-green-700 focus:outline-none focus:ring-1 focus:ring-green-300 transition-colors duration-150"
            aria-label={`Complete task "${task.title}"`}
            title="Mark complete"
          >
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
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

TaskItem.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    priority: PropTypes.string,
    status: PropTypes.string,
    dueDate: PropTypes.string,
    category: PropTypes.string,
    memberId: PropTypes.string,
    assignedTo: PropTypes.string,
    completedAt: PropTypes.string,
  }).isRequired,
  onComplete: PropTypes.func.isRequired,
  onSnooze: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

TaskItem.defaultProps = {
  disabled: false,
};

/**
 * Alert detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.alert - The alert to display
 * @param {Function} props.onAcknowledge - Acknowledge handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement|null}
 */
function AlertDetailModal({ isOpen, onClose, alert, onAcknowledge, disabled = false }) {
  if (!alert) {
    return null;
  }

  const severityStyle = ALERT_SEVERITY_STYLES[alert.severity] || DEFAULT_ALERT_SEVERITY_STYLE;
  const isAcknowledged = alert.acknowledged === true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Alert Details"
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${isAcknowledged ? 'bg-gray-50 border-gray-200' : `${severityStyle.bg} ${severityStyle.border}`}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityStyle.dot}`} aria-hidden="true" />
                {toTitleCase(alert.severity || 'medium')}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {alert.title || 'Alert'}
              </span>
            </div>
            {isAcknowledged && (
              <StatusBadge status="completed" label="Acknowledged" size="sm" showDot={true} bordered={true} />
            )}
          </div>
        </div>

        {/* Alert Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Alert ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={alert.id}>
              {alert.id ? alert.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Severity</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(alert.severity || 'medium')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={alert.memberId}>
              {alert.memberId ? alert.memberId.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Assigned To</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">
              {alert.assignedTo ? alert.assignedTo.substring(0, 12) + '…' : 'Unassigned'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {alert.createdAt ? formatDateTime(alert.createdAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {isAcknowledged ? 'Acknowledged' : 'Active'}
            </p>
          </div>
        </div>

        {/* Description */}
        {alert.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {alert.description}
              </p>
            </div>
          </div>
        )}

        {/* Acknowledged Info */}
        {isAcknowledged && alert.acknowledgedAt && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700">
              Acknowledged {formatRelativeTime(alert.acknowledgedAt)}
              {alert.acknowledgedBy && ` by ${alert.acknowledgedBy.substring(0, 12)}…`}
            </p>
          </div>
        )}

        {/* Actions */}
        {!isAcknowledged && !disabled && (
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
              onClick={() => {
                onAcknowledge(alert.id);
                onClose();
              }}
              iconLeft={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              Acknowledge
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

AlertDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  alert: PropTypes.object,
  onAcknowledge: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AlertDetailModal.defaultProps = {
  alert: null,
  disabled: false,
};

/**
 * Task detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.task - The task to display
 * @param {Function} props.onComplete - Complete handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement|null}
 */
function TaskDetailModal({ isOpen, onClose, task, onComplete, disabled = false }) {
  if (!task) {
    return null;
  }

  const priorityStyle = TASK_PRIORITY_STYLES[task.priority] || DEFAULT_TASK_PRIORITY_STYLE;
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && !isCompleted && !isCancelled && new Date(task.dueDate + 'T23:59:59').getTime() < Date.now();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Details"
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          isCompleted ? 'bg-green-50 border-green-200' :
          isOverdue ? 'bg-red-50 border-red-200' :
          'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                {toTitleCase(task.priority || 'medium')}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {task.title || 'Unnamed Task'}
              </span>
            </div>
            {isOverdue && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                OVERDUE
              </span>
            )}
          </div>
        </div>

        {/* Task Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Task ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={task.id}>
              {task.id ? task.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(task.status || 'pending')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Priority</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(task.priority || 'medium')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Category</p>
            <p className="text-xs text-gray-700 mt-0.5">{task.category ? toTitleCase(task.category) : '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Due Date</p>
            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
              {task.dueDate ? formatDate(task.dueDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Assigned To</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">
              {task.assignedTo ? task.assignedTo.substring(0, 12) + '…' : 'Unassigned'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={task.memberId}>
              {task.memberId ? task.memberId.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {task.createdAt ? formatDateTime(task.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          </div>
        )}

        {/* Completed Info */}
        {isCompleted && task.completedAt && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700">
              Completed {formatRelativeTime(task.completedAt)}
              {task.completedBy && ` by ${task.completedBy.substring(0, 12)}…`}
            </p>
          </div>
        )}

        {/* Actions */}
        {!isCompleted && !isCancelled && !disabled && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              variant="success"
              size="md"
              onClick={() => {
                onComplete(task.id);
                onClose();
              }}
              iconLeft={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              Mark Complete
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

TaskDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  task: PropTypes.object,
  onComplete: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

TaskDetailModal.defaultProps = {
  task: null,
  disabled: false,
};

/**
 * Care management alerts and tasks list component.
 * Displays active alerts (overdue HRA, care gaps, missed appointments)
 * and tasks (follow-ups, assessments) with priority, due date, assigned
 * care manager, and status. Supports mark complete and snooze actions.
 *
 * @param {Object} props
 * @param {string} [props.memberId] - Filter by member ID
 * @param {string} [props.careManagerId] - Filter by care manager ID
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Alerts & Tasks'] - Section title
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.showAlerts=true] - Whether to show alerts tab
 * @param {boolean} [props.showTasks=true] - Whether to show tasks tab
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=10] - Initial page size
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {Function} [props.onAlertAction] - Callback when an alert action is performed: (action, alertId) => void
 * @param {Function} [props.onTaskAction] - Callback when a task action is performed: (action, taskId) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function AlertsTasksList({
  memberId,
  careManagerId,
  showHeader = true,
  title = 'Alerts & Tasks',
  showStats = true,
  showAlerts = true,
  showTasks = true,
  compact = false,
  initialPageSize = 10,
  refreshInterval = 0,
  onAlertAction,
  onTaskAction,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [alerts, setAlerts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('');
  const [alertStatusFilter, setAlertStatusFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');

  // Modal state
  const [alertDetailModalOpen, setAlertDetailModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [snoozeConfirmOpen, setSnoozeConfirmOpen] = useState(false);
  const [snoozeTargetId, setSnoozeTargetId] = useState(null);
  const [snoozeTargetType, setSnoozeTargetType] = useState(null);

  /**
   * Loads members from localStorage.
   */
  useEffect(() => {
    try {
      const storedMembers = localStorage.getItem('csnp_members');
      if (storedMembers) {
        const parsed = JSON.parse(storedMembers);
        if (Array.isArray(parsed)) {
          setMembers(parsed);
        }
      }
    } catch {
      setMembers([]);
    }
  }, []);

  /**
   * Loads alerts and tasks data.
   */
  const loadData = useCallback(() => {
    setError(null);

    try {
      let loadedAlerts = [];
      let loadedTasks = [];

      if (memberId && typeof memberId === 'string' && memberId.trim().length > 0) {
        loadedAlerts = showAlerts ? getMemberAlerts(memberId.trim()) : [];
        loadedTasks = showTasks ? getMemberTasks(memberId.trim()) : [];
      } else if (careManagerId && typeof careManagerId === 'string' && careManagerId.trim().length > 0) {
        loadedAlerts = showAlerts ? getCareManagerAlerts(careManagerId.trim()) : [];
        loadedTasks = showTasks ? getCareManagerTasks(careManagerId.trim()) : [];
      } else {
        // Load all alerts and tasks from localStorage
        try {
          const storedAlerts = localStorage.getItem('csnp_care_alerts');
          if (storedAlerts) {
            const parsed = JSON.parse(storedAlerts);
            if (Array.isArray(parsed)) {
              loadedAlerts = showAlerts ? parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
            }
          }
        } catch {
          loadedAlerts = [];
        }

        try {
          const storedTasks = localStorage.getItem('csnp_care_tasks');
          if (storedTasks) {
            const parsed = JSON.parse(storedTasks);
            if (Array.isArray(parsed)) {
              loadedTasks = showTasks ? parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
            }
          }
        } catch {
          loadedTasks = [];
        }
      }

      setAlerts(Array.isArray(loadedAlerts) ? loadedAlerts : []);
      setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
    } catch (err) {
      console.error('AlertsTasksList: failed to load data:', err);
      setError('Unable to load alerts and tasks data');
    } finally {
      setLoading(false);
    }
  }, [memberId, careManagerId, showAlerts, showTasks]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Auto-refresh interval.
   */
  useEffect(() => {
    if (typeof refreshInterval !== 'number' || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval, loadData]);

  /**
   * Enriched alerts with member names.
   */
  const enrichedAlerts = useMemo(() => {
    return alerts.map((alert) => {
      const member = members.find((m) => m.id === alert.memberId);
      return {
        ...alert,
        _memberName: member
          ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
          : alert.memberId ? alert.memberId.substring(0, 12) + '…' : '—',
      };
    });
  }, [alerts, members]);

  /**
   * Enriched tasks with member names.
   */
  const enrichedTasks = useMemo(() => {
    return tasks.map((task) => {
      const member = members.find((m) => m.id === task.memberId);
      const isOverdue = task.dueDate && task.status !== 'completed' && task.status !== 'cancelled' && new Date(task.dueDate + 'T23:59:59').getTime() < Date.now();
      return {
        ...task,
        _memberName: member
          ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
          : task.memberId ? task.memberId.substring(0, 12) + '…' : '—',
        _isOverdue: isOverdue,
      };
    });
  }, [tasks, members]);

  /**
   * Filtered alerts.
   */
  const filteredAlerts = useMemo(() => {
    let filtered = enrichedAlerts;

    if (alertSeverityFilter && alertSeverityFilter.trim().length > 0) {
      filtered = filtered.filter((a) => a.severity === alertSeverityFilter.trim());
    }

    if (alertStatusFilter === 'unacknowledged') {
      filtered = filtered.filter((a) => !a.acknowledged);
    } else if (alertStatusFilter === 'acknowledged') {
      filtered = filtered.filter((a) => a.acknowledged === true);
    }

    return filtered;
  }, [enrichedAlerts, alertSeverityFilter, alertStatusFilter]);

  /**
   * Filtered tasks.
   */
  const filteredTasks = useMemo(() => {
    let filtered = enrichedTasks;

    if (taskPriorityFilter && taskPriorityFilter.trim().length > 0) {
      filtered = filtered.filter((t) => t.priority === taskPriorityFilter.trim());
    }

    if (taskStatusFilter && taskStatusFilter.trim().length > 0) {
      filtered = filtered.filter((t) => t.status === taskStatusFilter.trim());
    }

    return filtered;
  }, [enrichedTasks, taskPriorityFilter, taskStatusFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const totalAlerts = alerts.length;
    const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
    const highAlerts = alerts.filter((a) => a.severity === 'high' && !a.acknowledged).length;

    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const overdueTasks = tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate + 'T23:59:59').getTime() < Date.now();
    }).length;

    return {
      totalAlerts,
      unacknowledgedAlerts,
      criticalAlerts,
      highAlerts,
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueTasks,
    };
  }, [alerts, tasks]);

  /**
   * Handles acknowledging an alert.
   * @param {string} alertId - The alert ID
   */
  const handleAcknowledgeAlert = useCallback((alertId) => {
    const performedBy = user ? user.id : 'system';
    const result = acknowledgeAlert(alertId, performedBy);

    if (result.success) {
      addNotification('info', 'Alert Acknowledged', 'The alert has been acknowledged.');
      loadData();

      if (typeof onAlertAction === 'function') {
        onAlertAction('acknowledge', alertId);
      }
    } else {
      addNotification(
        'error',
        'Acknowledgment Failed',
        result.error || 'An error occurred while acknowledging the alert.'
      );
    }
  }, [user, addNotification, loadData, onAlertAction]);

  /**
   * Handles completing a task.
   * @param {string} taskId - The task ID
   */
  const handleCompleteTask = useCallback((taskId) => {
    const performedBy = user ? user.id : 'system';
    const result = completeTask(taskId, performedBy);

    if (result.success) {
      const task = tasks.find((t) => t.id === taskId);
      addNotification(
        'success',
        'Task Completed',
        `Task "${task ? task.title : taskId}" has been completed.`
      );
      loadData();

      if (typeof onTaskAction === 'function') {
        onTaskAction('complete', taskId);
      }
    } else {
      addNotification(
        'error',
        'Completion Failed',
        result.error || 'An error occurred while completing the task.'
      );
    }
  }, [user, tasks, addNotification, loadData, onTaskAction]);

  /**
   * Handles initiating a snooze action.
   * @param {string} id - The alert or task ID
   * @param {string} type - 'alert' or 'task'
   */
  const handleSnoozeInit = useCallback((id, type) => {
    setSnoozeTargetId(id);
    setSnoozeTargetType(type);
    setSnoozeConfirmOpen(true);
  }, []);

  /**
   * Confirms and executes snooze action.
   */
  const handleConfirmSnooze = useCallback(() => {
    setSnoozeConfirmOpen(false);

    if (snoozeTargetType === 'alert') {
      addNotification(
        'info',
        'Alert Snoozed',
        'The alert has been snoozed. It will reappear in 24 hours.'
      );

      if (typeof onAlertAction === 'function') {
        onAlertAction('snooze', snoozeTargetId);
      }
    } else if (snoozeTargetType === 'task') {
      addNotification(
        'info',
        'Task Snoozed',
        'The task has been snoozed. It will reappear in 24 hours.'
      );

      if (typeof onTaskAction === 'function') {
        onTaskAction('snooze', snoozeTargetId);
      }
    }

    setSnoozeTargetId(null);
    setSnoozeTargetType(null);
  }, [snoozeTargetId, snoozeTargetType, addNotification, onAlertAction, onTaskAction]);

  /**
   * Handles viewing alert details.
   * @param {Object} alert - The alert object
   */
  const handleViewAlertDetails = useCallback((alert) => {
    setSelectedAlert(alert);
    setAlertDetailModalOpen(true);
  }, []);

  /**
   * Handles viewing task details.
   * @param {Object} task - The task object
   */
  const handleViewTaskDetails = useCallback((task) => {
    setSelectedTask(task);
    setTaskDetailModalOpen(true);
  }, []);

  /**
   * Renders the Alerts tab content.
   */
  function renderAlertsTab() {
    if (filteredAlerts.length === 0) {
      if (alerts.length > 0) {
        return (
          <EmptyState
            title="No Matching Alerts"
            description="No alerts match the selected filters."
            iconType="no-results"
            size="sm"
            actionLabel="Clear Filters"
            onAction={() => {
              setAlertSeverityFilter('');
              setAlertStatusFilter('');
            }}
            actionVariant="outline"
          />
        );
      }

      return (
        <EmptyState
          title="No Alerts"
          description="No care management alerts are currently active."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-2">
        {filteredAlerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledgeAlert}
            onSnooze={(id) => handleSnoozeInit(id, 'alert')}
            onViewDetails={handleViewAlertDetails}
            disabled={!isAuthenticated}
          />
        ))}
      </div>
    );
  }

  /**
   * Renders the Tasks tab content.
   */
  function renderTasksTab() {
    if (filteredTasks.length === 0) {
      if (tasks.length > 0) {
        return (
          <EmptyState
            title="No Matching Tasks"
            description="No tasks match the selected filters."
            iconType="no-results"
            size="sm"
            actionLabel="Clear Filters"
            onAction={() => {
              setTaskPriorityFilter('');
              setTaskStatusFilter('');
            }}
            actionVariant="outline"
          />
        );
      }

      return (
        <EmptyState
          title="No Tasks"
          description="No care management tasks are currently assigned."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onComplete={handleCompleteTask}
            onSnooze={(id) => handleSnoozeInit(id, 'task')}
            onViewDetails={handleViewTaskDetails}
            disabled={!isAuthenticated}
          />
        ))}
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [];

    if (showAlerts) {
      tabList.push({
        key: 'alerts',
        label: 'Alerts',
        badge: stats.unacknowledgedAlerts > 0 ? String(stats.unacknowledgedAlerts) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        content: !loading && !error ? (
          <div className="space-y-3 pt-3">
            {/* Alert Filters */}
            {!compact && (
              <div className="flex items-center gap-2">
                <select
                  value={alertSeverityFilter}
                  onChange={(e) => setAlertSeverityFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter alerts by severity"
                >
                  {SEVERITY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={alertStatusFilter}
                  onChange={(e) => setAlertStatusFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter alerts by status"
                >
                  {ALERT_STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {filteredAlerts.length} of {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {renderAlertsTab()}
          </div>
        ) : null,
      });
    }

    if (showTasks) {
      tabList.push({
        key: 'tasks',
        label: 'Tasks',
        badge: stats.pendingTasks > 0 ? String(stats.pendingTasks) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        content: !loading && !error ? (
          <div className="space-y-3 pt-3">
            {/* Task Filters */}
            {!compact && (
              <div className="flex items-center gap-2">
                <select
                  value={taskPriorityFilter}
                  onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter tasks by priority"
                >
                  {PRIORITY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter tasks by status"
                >
                  {TASK_STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {renderTasksTab()}
          </div>
        ) : null,
      });
    }

    return tabList;
  }, [showAlerts, showTasks, loading, error, filteredAlerts, filteredTasks, alerts, tasks, stats, compact, alertSeverityFilter, alertStatusFilter, taskPriorityFilter, taskStatusFilter, isAuthenticated, handleAcknowledgeAlert, handleCompleteTask, handleSnoozeInit, handleViewAlertDetails, handleViewTaskDetails]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Alerts/Tasks icon */}
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
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && (stats.unacknowledgedAlerts > 0 || stats.pendingTasks > 0) && (
                <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                  {stats.unacknowledgedAlerts + stats.pendingTasks} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
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

          {/* Summary Stats */}
          {showStats && !loading && !error && !compact && (alerts.length > 0 || tasks.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {showAlerts && (
                <>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">Active Alerts</p>
                    <p className={`text-lg font-bold ${stats.unacknowledgedAlerts > 0 ? 'text-orange-700' : 'text-orange-400'}`}>
                      {stats.unacknowledgedAlerts}
                    </p>
                    {stats.criticalAlerts > 0 && (
                      <p className="text-[10px] text-red-600 font-medium">{stats.criticalAlerts} critical</p>
                    )}
                  </div>
                </>
              )}
              {showTasks && (
                <>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Pending Tasks</p>
                    <p className={`text-lg font-bold ${stats.pendingTasks > 0 ? 'text-yellow-700' : 'text-yellow-400'}`}>
                      {stats.pendingTasks}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Overdue Tasks</p>
                    <p className={`text-lg font-bold ${stats.overdueTasks > 0 ? 'text-red-700' : 'text-red-400'}`}>
                      {stats.overdueTasks}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Completed Tasks</p>
                    <p className="text-lg font-bold text-green-700">
                      {stats.completedTasks}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Critical Alerts Banner */}
      {!loading && !error && stats.criticalAlerts > 0 && (
        <Alert
          variant="error"
          title={`${stats.criticalAlerts} Critical Alert${stats.criticalAlerts !== 1 ? 's' : ''}`}
          showIcon={true}
          bordered={true}
          size="sm"
          className="mb-4"
        >
          Immediate attention required for critical care management alerts.
        </Alert>
      )}

      {/* Overdue Tasks Banner */}
      {!loading && !error && stats.overdueTasks > 0 && stats.criticalAlerts === 0 && (
        <Alert
          variant="warning"
          title={`${stats.overdueTasks} Overdue Task${stats.overdueTasks !== 1 ? 's' : ''}`}
          showIcon={true}
          bordered={true}
          size="sm"
          className="mb-4"
        >
          {stats.overdueTasks === 1
            ? '1 task is past its due date. Please review and complete or reschedule.'
            : `${stats.overdueTasks} tasks are past their due dates. Please review and complete or reschedule.`}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <AlertsTasksListSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load alerts and tasks"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && alerts.length === 0 && tasks.length === 0 && (
        <EmptyState
          title="No Alerts or Tasks"
          description="No care management alerts or tasks are currently active. Alerts and tasks will appear here as care management events are triggered."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Tabs */}
      {!loading && !error && (alerts.length > 0 || tasks.length > 0) && (
        <Tabs
          tabs={tabs}
          defaultActiveKey={showAlerts && stats.unacknowledgedAlerts > 0 ? 'alerts' : showTasks ? 'tasks' : 'alerts'}
          variant="underline"
          size="sm"
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && (alerts.length > 0 || tasks.length > 0) && (
        <div className="mt-4">
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
              Care management alerts and tasks are tracked per CMS C-SNP requirements (42 CFR §422.101).
              Critical alerts require immediate attention. Overdue tasks should be addressed promptly
              to maintain care coordination quality. All actions are logged in the audit trail.
            </p>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      <AlertDetailModal
        isOpen={alertDetailModalOpen}
        onClose={() => {
          setAlertDetailModalOpen(false);
          setSelectedAlert(null);
        }}
        alert={selectedAlert}
        onAcknowledge={handleAcknowledgeAlert}
        disabled={!isAuthenticated}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={taskDetailModalOpen}
        onClose={() => {
          setTaskDetailModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onComplete={handleCompleteTask}
        disabled={!isAuthenticated}
      />

      {/* Snooze Confirm Dialog */}
      <ConfirmDialog
        isOpen={snoozeConfirmOpen}
        onClose={() => {
          setSnoozeConfirmOpen(false);
          setSnoozeTargetId(null);
          setSnoozeTargetType(null);
        }}
        onConfirm={handleConfirmSnooze}
        title={`Snooze ${snoozeTargetType === 'alert' ? 'Alert' : 'Task'}`}
        message={`Are you sure you want to snooze this ${snoozeTargetType === 'alert' ? 'alert' : 'task'}? It will be hidden for 24 hours and then reappear.`}
        confirmText="Snooze"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

AlertsTasksList.propTypes = {
  memberId: PropTypes.string,
  careManagerId: PropTypes.string,
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showStats: PropTypes.bool,
  showAlerts: PropTypes.bool,
  showTasks: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  refreshInterval: PropTypes.number,
  onAlertAction: PropTypes.func,
  onTaskAction: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

AlertsTasksList.defaultProps = {
  memberId: undefined,
  careManagerId: undefined,
  showHeader: true,
  title: 'Alerts & Tasks',
  showStats: true,
  showAlerts: true,
  showTasks: true,
  compact: false,
  initialPageSize: 10,
  refreshInterval: 0,
  onAlertAction: undefined,
  onTaskAction: undefined,
  className: '',
  headerActions: null,
};