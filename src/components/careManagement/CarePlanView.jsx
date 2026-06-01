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
import Tabs from '../common/Tabs.jsx';
import {
  getActiveCarePlan,
  getMemberCarePlans,
  getMemberCareEvents,
  getMemberTasks,
  getMemberAlerts,
  getActiveCareManagerAssignment,
  generateCarePlan,
  updateCarePlanGoal,
  completeTask,
  acknowledgeAlert,
  triggerCareManagement,
} from '../../services/careManagementService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
  calculateAge,
} from '../../utils/helpers.js';
import {
  CARE_MANAGEMENT_EVENTS,
  CARE_MANAGEMENT_EVENT_LABELS,
} from '../../utils/constants.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Goal status to display style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, label: string }>}
 */
const GOAL_STATUS_STYLES = {
  active: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Active' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Completed' },
  on_hold: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'On Hold' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Cancelled' },
};

/**
 * Default goal status style.
 * @type {{ bg: string, text: string, border: string, label: string }}
 */
const DEFAULT_GOAL_STATUS_STYLE = { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Unknown' };

/**
 * Goal category to icon color mapping.
 * @type {Object.<string, { bg: string, text: string }>}
 */
const GOAL_CATEGORY_COLORS = {
  clinical: { bg: 'bg-red-50', text: 'text-red-600' },
  monitoring: { bg: 'bg-blue-50', text: 'text-blue-600' },
  medication: { bg: 'bg-purple-50', text: 'text-purple-600' },
  education: { bg: 'bg-green-50', text: 'text-green-600' },
  preventive: { bg: 'bg-teal-50', text: 'text-teal-600' },
  rehabilitation: { bg: 'bg-orange-50', text: 'text-orange-600' },
  lifestyle: { bg: 'bg-pink-50', text: 'text-pink-600' },
  safety: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
  social: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  general: { bg: 'bg-gray-50', text: 'text-gray-500' },
};

/**
 * Default goal category color.
 * @type {{ bg: string, text: string }}
 */
const DEFAULT_GOAL_CATEGORY_COLOR = { bg: 'bg-gray-50', text: 'text-gray-500' };

/**
 * Task priority to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string }>}
 */
const TASK_PRIORITY_STYLES = {
  urgent: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

/**
 * Alert severity to style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string }>}
 */
const ALERT_SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

/**
 * Skeleton loading state for the care plan view.
 * @returns {React.ReactElement}
 */
function CarePlanViewSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-20 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
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
 * Progress bar component for care plan goal completion.
 *
 * @param {Object} props
 * @param {number} props.completed - Number of completed goals
 * @param {number} props.total - Total number of goals
 * @returns {React.ReactElement}
 */
function GoalProgressBar({ completed, total }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  let barColor = 'bg-csnp-primary';
  if (percentage >= 75) {
    barColor = 'bg-green-500';
  } else if (percentage >= 50) {
    barColor = 'bg-blue-500';
  } else if (percentage >= 25) {
    barColor = 'bg-yellow-500';
  } else {
    barColor = 'bg-gray-400';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500">Goal Progress</span>
        <span className="text-[10px] font-semibold text-gray-700">
          {completed}/{total} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Goal progress: ${percentage}%`}
        />
      </div>
    </div>
  );
}

GoalProgressBar.propTypes = {
  completed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};

/**
 * Single care plan goal item component.
 *
 * @param {Object} props
 * @param {Object} props.goal - The goal object
 * @param {Function} props.onStatusChange - Status change handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function GoalItem({ goal, onStatusChange, disabled = false }) {
  const statusStyle = GOAL_STATUS_STYLES[goal.status] || DEFAULT_GOAL_STATUS_STYLE;
  const categoryColor = GOAL_CATEGORY_COLORS[goal.category] || DEFAULT_GOAL_CATEGORY_COLOR;
  const isCompleted = goal.status === 'completed';
  const isCancelled = goal.status === 'cancelled';

  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const priorityLabel = goal.priority ? toTitleCase(goal.priority) : 'Medium';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      isCompleted
        ? 'bg-green-50 border-green-200'
        : isCancelled
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      {/* Status Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${categoryColor.bg} ${categoryColor.text}`}>
        {isCompleted ? (
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
        ) : (
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
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      {/* Goal Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-semibold ${isCompleted ? 'text-green-800 line-through' : 'text-gray-900'}`}>
            {goal.goal || 'Unnamed Goal'}
          </p>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            {statusStyle.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${categoryColor.bg} ${categoryColor.text}`}>
            {toTitleCase(goal.category || 'general')}
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-500">
            Priority: {priorityLabel}
          </span>
          {goal.targetDate && (
            <>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-[10px] text-gray-500">
                Target: {formatDate(goal.targetDate)}
              </span>
            </>
          )}
          {goal.completedDate && (
            <>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-[10px] text-green-600">
                Completed: {formatDate(goal.completedDate)}
              </span>
            </>
          )}
        </div>

        {goal.notes && typeof goal.notes === 'string' && goal.notes.trim().length > 0 && (
          <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[400px]" title={goal.notes}>
            {goal.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {!disabled && !isCompleted && !isCancelled && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onStatusChange(goal.id, 'completed')}
            className="p-1.5 rounded text-green-500 hover:bg-green-50 hover:text-green-700 focus:outline-none focus:ring-1 focus:ring-green-300 transition-colors duration-150"
            aria-label={`Complete goal "${goal.goal}"`}
            title="Mark as completed"
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
          <button
            type="button"
            onClick={() => onStatusChange(goal.id, goal.status === 'on_hold' ? 'active' : 'on_hold')}
            className="p-1.5 rounded text-yellow-500 hover:bg-yellow-50 hover:text-yellow-700 focus:outline-none focus:ring-1 focus:ring-yellow-300 transition-colors duration-150"
            aria-label={goal.status === 'on_hold' ? `Resume goal "${goal.goal}"` : `Pause goal "${goal.goal}"`}
            title={goal.status === 'on_hold' ? 'Resume' : 'Put on hold'}
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
              {goal.status === 'on_hold' ? (
                <polygon points="5 3 19 12 5 21 5 3" />
              ) : (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              )}
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

GoalItem.propTypes = {
  goal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    goal: PropTypes.string.isRequired,
    category: PropTypes.string,
    priority: PropTypes.string,
    status: PropTypes.string,
    targetDate: PropTypes.string,
    completedDate: PropTypes.string,
    notes: PropTypes.string,
  }).isRequired,
  onStatusChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

GoalItem.defaultProps = {
  disabled: false,
};

/**
 * Task item component for the care plan view.
 *
 * @param {Object} props
 * @param {Object} props.task - The task object
 * @param {Function} props.onComplete - Complete handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function TaskItem({ task, onComplete, disabled = false }) {
  const priorityStyle = TASK_PRIORITY_STYLES[task.priority] || TASK_PRIORITY_STYLES.medium;
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isOverdue = task.dueDate && !isCompleted && !isCancelled && new Date(task.dueDate + 'T23:59:59').getTime() < Date.now();

  return (
    <div className={`flex items-start gap-3 py-2.5 ${!disabled ? 'border-b border-gray-100 last:border-b-0' : ''}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
        isCompleted ? 'bg-green-50 text-green-600' : isOverdue ? 'bg-red-50 text-red-600' : `${priorityStyle.bg} ${priorityStyle.text}`
      }`}>
        {isCompleted ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-xs font-medium ${isCompleted ? 'text-green-700 line-through' : isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
            {task.title || 'Unnamed Task'}
          </p>
          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
            {toTitleCase(task.priority || 'medium')}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
              OVERDUE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
          {task.dueDate && (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due: {formatDate(task.dueDate)}
            </span>
          )}
          {task.category && (
            <>
              <span>·</span>
              <span>{toTitleCase(task.category)}</span>
            </>
          )}
          {task.completedAt && (
            <>
              <span>·</span>
              <span className="text-green-500">Completed {formatRelativeTime(task.completedAt)}</span>
            </>
          )}
        </div>
      </div>

      {!disabled && !isCompleted && !isCancelled && (
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          className="flex-shrink-0 p-1.5 rounded text-green-500 hover:bg-green-50 hover:text-green-700 focus:outline-none focus:ring-1 focus:ring-green-300 transition-colors duration-150"
          aria-label={`Complete task "${task.title}"`}
          title="Complete task"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}

TaskItem.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    priority: PropTypes.string,
    status: PropTypes.string,
    dueDate: PropTypes.string,
    category: PropTypes.string,
    completedAt: PropTypes.string,
  }).isRequired,
  onComplete: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

TaskItem.defaultProps = {
  disabled: false,
};

/**
 * Alert item component for the care plan view.
 *
 * @param {Object} props
 * @param {Object} props.alert - The alert object
 * @param {Function} props.onAcknowledge - Acknowledge handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function AlertItem({ alert, onAcknowledge, disabled = false }) {
  const severityStyle = ALERT_SEVERITY_STYLES[alert.severity] || ALERT_SEVERITY_STYLES.medium;
  const isAcknowledged = alert.acknowledged === true;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      isAcknowledged ? 'bg-gray-50 border-gray-200 opacity-60' : `${severityStyle.bg} ${severityStyle.border}`
    }`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isAcknowledged ? 'bg-gray-200 text-gray-400' : `${severityStyle.bg} ${severityStyle.text}`
      }`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-xs font-semibold ${isAcknowledged ? 'text-gray-500' : 'text-gray-900'}`}>
            {alert.title || 'Alert'}
          </p>
          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}>
            {toTitleCase(alert.severity || 'medium')}
          </span>
          {isAcknowledged && (
            <span className="text-[10px] text-gray-400">Acknowledged</span>
          )}
        </div>
        {alert.description && (
          <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">
            {alert.description}
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">
          {formatRelativeTime(alert.createdAt)}
        </p>
      </div>

      {!disabled && !isAcknowledged && (
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          className="flex-shrink-0 p-1.5 rounded text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
          aria-label={`Acknowledge alert "${alert.title}"`}
          title="Acknowledge"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
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
    createdAt: PropTypes.string,
  }).isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AlertItem.defaultProps = {
  disabled: false,
};

/**
 * Care event timeline item component.
 *
 * @param {Object} props
 * @param {Object} props.event - The care event object
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function CareEventTimelineItem({ event, isLast = false }) {
  const eventLabel = CARE_MANAGEMENT_EVENT_LABELS[event.eventType] || toTitleCase(event.eventType || 'unknown');

  const eventColors = {
    assessment: { bg: 'bg-blue-50', text: 'text-blue-600' },
    care_plan_created: { bg: 'bg-green-50', text: 'text-green-600' },
    care_plan_updated: { bg: 'bg-csnp-blue-50', text: 'text-csnp-primary' },
    care_plan_reviewed: { bg: 'bg-purple-50', text: 'text-purple-600' },
    phone_call: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    home_visit: { bg: 'bg-teal-50', text: 'text-teal-600' },
    office_visit: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    hospitalization: { bg: 'bg-red-50', text: 'text-red-600' },
    discharge: { bg: 'bg-orange-50', text: 'text-orange-600' },
    transition_of_care: { bg: 'bg-amber-50', text: 'text-amber-600' },
    medication_review: { bg: 'bg-violet-50', text: 'text-violet-600' },
    referral_made: { bg: 'bg-pink-50', text: 'text-pink-600' },
    goal_met: { bg: 'bg-green-50', text: 'text-green-600' },
    escalation: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  const colors = eventColors[event.eventType] || { bg: 'bg-gray-50', text: 'text-gray-500' };

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        {!isLast && (
          <div className="w-0.5 h-full min-h-[20px] bg-gray-200 mt-1" aria-hidden="true" />
        )}
      </div>

      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-900">{eventLabel}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {toTitleCase(event.status || 'completed')}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2" title={formatDateTime(event.createdAt)}>
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
          {event.summary || `${eventLabel} event recorded`}
        </p>
        {event.followUpDate && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            Follow-up: {formatDate(event.followUpDate)}
          </p>
        )}
      </div>
    </div>
  );
}

CareEventTimelineItem.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    eventType: PropTypes.string,
    summary: PropTypes.string,
    status: PropTypes.string,
    followUpDate: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  isLast: PropTypes.bool,
};

CareEventTimelineItem.defaultProps = {
  isLast: false,
};

/**
 * Care team display component.
 *
 * @param {Object} props
 * @param {Object|null} props.careManagerAssignment - The active care manager assignment
 * @param {Object|null} props.member - The member object
 * @param {Object|null} props.carePlan - The active care plan
 * @returns {React.ReactElement}
 */
function CareTeamDisplay({ careManagerAssignment, member, carePlan }) {
  const [careManager, setCareManager] = useState(null);
  const [primaryProvider, setPrimaryProvider] = useState(null);

  useEffect(() => {
    if (careManagerAssignment && careManagerAssignment.managerId) {
      try {
        const storedUsers = localStorage.getItem('csnp_users');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          if (Array.isArray(users)) {
            const manager = users.find((u) => u.id === careManagerAssignment.managerId);
            setCareManager(manager || null);
          }
        }
      } catch {
        setCareManager(null);
      }
    } else {
      setCareManager(null);
    }
  }, [careManagerAssignment]);

  useEffect(() => {
    const providerId = (carePlan && carePlan.primaryProviderId) || (member && member.primaryProviderId);
    if (providerId) {
      try {
        const storedProviders = localStorage.getItem('csnp_providers');
        if (storedProviders) {
          const providers = JSON.parse(storedProviders);
          if (Array.isArray(providers)) {
            const provider = providers.find((p) => p.id === providerId);
            setPrimaryProvider(provider || null);
          }
        }
      } catch {
        setPrimaryProvider(null);
      }
    } else {
      setPrimaryProvider(null);
    }
  }, [carePlan, member]);

  return (
    <div className="space-y-3">
      {/* Care Manager */}
      <div className="flex items-center gap-3 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
          {careManager
            ? `${careManager.firstName ? careManager.firstName.charAt(0).toUpperCase() : ''}${careManager.lastName ? careManager.lastName.charAt(0).toUpperCase() : ''}`
            : 'CM'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-csnp-primary">
            {careManager ? `${careManager.firstName} ${careManager.lastName}` : 'Not Assigned'}
          </p>
          <p className="text-[10px] text-csnp-blue-700">
            Care Manager
            {careManagerAssignment && careManagerAssignment.assignedDate && (
              <span> · Assigned {formatRelativeTime(careManagerAssignment.createdAt || careManagerAssignment.assignedDate)}</span>
            )}
          </p>
        </div>
        <StatusBadge
          status={careManager ? 'active' : 'pending'}
          label={careManager ? 'Active' : 'Unassigned'}
          size="sm"
          showDot={true}
          bordered={true}
        />
      </div>

      {/* Primary Provider */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
          {primaryProvider
            ? `${primaryProvider.firstName ? primaryProvider.firstName.charAt(0).toUpperCase() : ''}${primaryProvider.lastName ? primaryProvider.lastName.charAt(0).toUpperCase() : ''}`
            : 'PCP'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900">
            {primaryProvider ? `${primaryProvider.firstName} ${primaryProvider.lastName}` : 'Not Assigned'}
          </p>
          <p className="text-[10px] text-gray-500">
            Primary Care Provider
            {primaryProvider && primaryProvider.specialty && (
              <span> · {primaryProvider.specialty}</span>
            )}
          </p>
        </div>
        <StatusBadge
          status={primaryProvider ? 'active' : 'pending'}
          label={primaryProvider ? 'Active' : 'Unassigned'}
          size="sm"
          showDot={true}
          bordered={true}
        />
      </div>

      {/* Member Info */}
      {member && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
            {member.firstName ? member.firstName.charAt(0).toUpperCase() : ''}
            {member.lastName ? member.lastName.charAt(0).toUpperCase() : ''}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-[10px] text-gray-500">
              Member
              {member.conditionCategory && (
                <span> · {CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory)}</span>
              )}
              {member.dateOfBirth && (
                <span> · Age {calculateAge(member.dateOfBirth) || '—'}</span>
              )}
            </p>
          </div>
          {member.csnpEligible && (
            <StatusBadge
              status="eligible"
              label="CSNP"
              size="sm"
              showDot={false}
              bordered={true}
            />
          )}
        </div>
      )}
    </div>
  );
}

CareTeamDisplay.propTypes = {
  careManagerAssignment: PropTypes.object,
  member: PropTypes.object,
  carePlan: PropTypes.object,
};

CareTeamDisplay.defaultProps = {
  careManagerAssignment: null,
  member: null,
  carePlan: null,
};

/**
 * Care plan display component.
 * Shows member's care plan with goals, interventions, assigned care team,
 * timeline, progress indicators, and action items. Supports care plan
 * generation and updates.
 *
 * @param {Object} props
 * @param {string} props.memberId - The member ID to display care plan for
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showCareTeam=true] - Whether to show the care team section
 * @param {boolean} [props.showTimeline=true] - Whether to show the care event timeline
 * @param {boolean} [props.showTasks=true] - Whether to show the tasks section
 * @param {boolean} [props.showAlerts=true] - Whether to show the alerts section
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onCarePlanChange] - Callback when care plan changes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function CarePlanView({
  memberId,
  showHeader = true,
  showCareTeam = true,
  showTimeline = true,
  showTasks = true,
  showAlerts = true,
  showActions = true,
  compact = false,
  onCarePlanChange,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [member, setMember] = useState(null);
  const [carePlan, setCarePlan] = useState(null);
  const [allCarePlans, setAllCarePlans] = useState([]);
  const [careEvents, setCareEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [careManagerAssignment, setCareManagerAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

  /**
   * Loads all care plan data for the member.
   */
  const loadCarePlanData = useCallback(() => {
    if (typeof memberId !== 'string' || memberId.trim().length === 0) {
      setError('Member ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Load member
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const members = JSON.parse(storedMembers);
          if (Array.isArray(members)) {
            const foundMember = members.find((m) => m.id === memberId.trim());
            setMember(foundMember || null);
          }
        }
      } catch {
        setMember(null);
      }

      // Load active care plan
      const activePlan = getActiveCarePlan(memberId.trim());
      setCarePlan(activePlan);

      // Load all care plans
      const plans = getMemberCarePlans(memberId.trim());
      setAllCarePlans(Array.isArray(plans) ? plans : []);

      // Load care events
      const events = getMemberCareEvents(memberId.trim());
      setCareEvents(Array.isArray(events) ? events.slice(0, 20) : []);

      // Load tasks
      if (showTasks) {
        const memberTasks = getMemberTasks(memberId.trim());
        setTasks(Array.isArray(memberTasks) ? memberTasks : []);
      }

      // Load alerts
      if (showAlerts) {
        const memberAlerts = getMemberAlerts(memberId.trim());
        setAlerts(Array.isArray(memberAlerts) ? memberAlerts : []);
      }

      // Load care manager assignment
      if (showCareTeam) {
        const assignment = getActiveCareManagerAssignment(memberId.trim());
        setCareManagerAssignment(assignment);
      }
    } catch (err) {
      console.error('CarePlanView: failed to load care plan data:', err);
      setError('Unable to load care plan data');
    } finally {
      setLoading(false);
    }
  }, [memberId, showTasks, showAlerts, showCareTeam]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadCarePlanData();
  }, [loadCarePlanData]);

  /**
   * Computed: goal statistics.
   */
  const goalStats = useMemo(() => {
    if (!carePlan || !Array.isArray(carePlan.goals)) {
      return { total: 0, active: 0, completed: 0, onHold: 0, cancelled: 0 };
    }

    const goals = carePlan.goals;
    return {
      total: goals.length,
      active: goals.filter((g) => g.status === 'active').length,
      completed: goals.filter((g) => g.status === 'completed').length,
      onHold: goals.filter((g) => g.status === 'on_hold').length,
      cancelled: goals.filter((g) => g.status === 'cancelled').length,
    };
  }, [carePlan]);

  /**
   * Computed: task statistics.
   */
  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      overdue: tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate + 'T23:59:59').getTime() < Date.now();
      }).length,
    };
  }, [tasks]);

  /**
   * Computed: alert statistics.
   */
  const alertStats = useMemo(() => {
    return {
      total: alerts.length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length,
    };
  }, [alerts]);

  /**
   * Computed: condition category label.
   */
  const conditionCategoryLabel = useMemo(() => {
    if (carePlan && carePlan.conditionCategoryLabel) {
      return carePlan.conditionCategoryLabel;
    }
    if (member && member.conditionCategory) {
      return CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory);
    }
    return null;
  }, [carePlan, member]);

  /**
   * Handles goal status change.
   * @param {string} goalId - The goal ID
   * @param {string} newStatus - The new status
   */
  const handleGoalStatusChange = useCallback((goalId, newStatus) => {
    if (!carePlan || !carePlan.id) {
      return;
    }

    const performedBy = user ? user.id : 'system';
    const result = updateCarePlanGoal(carePlan.id, goalId, newStatus, performedBy);

    if (result.success) {
      const goal = carePlan.goals.find((g) => g.id === goalId);
      addNotification(
        'success',
        `Goal ${toTitleCase(newStatus)}`,
        `Goal "${goal ? goal.goal : goalId}" has been updated to ${newStatus}.`
      );
      loadCarePlanData();

      if (typeof onCarePlanChange === 'function') {
        onCarePlanChange({ action: 'goal_update', goalId, newStatus });
      }
    } else {
      addNotification(
        'error',
        'Update Failed',
        result.error || 'An error occurred while updating the goal.'
      );
    }
  }, [carePlan, user, addNotification, loadCarePlanData, onCarePlanChange]);

  /**
   * Handles task completion.
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
      loadCarePlanData();
    } else {
      addNotification(
        'error',
        'Completion Failed',
        result.error || 'An error occurred while completing the task.'
      );
    }
  }, [user, tasks, addNotification, loadCarePlanData]);

  /**
   * Handles alert acknowledgment.
   * @param {string} alertId - The alert ID
   */
  const handleAcknowledgeAlert = useCallback((alertId) => {
    const performedBy = user ? user.id : 'system';
    const result = acknowledgeAlert(alertId, performedBy);

    if (result.success) {
      addNotification('info', 'Alert Acknowledged', 'The alert has been acknowledged.');
      loadCarePlanData();
    } else {
      addNotification(
        'error',
        'Acknowledgment Failed',
        result.error || 'An error occurred while acknowledging the alert.'
      );
    }
  }, [user, addNotification, loadCarePlanData]);

  /**
   * Handles care plan generation.
   */
  const handleGenerateCarePlan = useCallback(() => {
    setGenerateConfirmOpen(false);
    setGenerating(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = generateCarePlan(memberId.trim(), { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Care Plan Generated',
          `A new care plan has been generated with ${result.carePlan ? result.carePlan.totalGoals : 0} goals.`
        );
        loadCarePlanData();

        if (typeof onCarePlanChange === 'function') {
          onCarePlanChange({ action: 'generate', carePlanId: result.carePlanId });
        }
      } else {
        addNotification(
          'error',
          'Generation Failed',
          result.error || 'An error occurred while generating the care plan.'
        );
      }
    } catch (err) {
      console.error('CarePlanView: generate error:', err);
      addNotification('error', 'Generation Error', 'An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  }, [memberId, user, addNotification, loadCarePlanData, onCarePlanChange]);

  const hasMemberId = typeof memberId === 'string' && memberId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  if (!hasMemberId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Member Selected"
          description="Select a member to view their care plan."
          iconType="no-data"
          size="sm"
        />
      </div>
    );
  }

  /**
   * Renders the Goals tab content.
   */
  function renderGoalsTab() {
    if (!carePlan || !Array.isArray(carePlan.goals) || carePlan.goals.length === 0) {
      return (
        <EmptyState
          title="No Care Plan Goals"
          description="No goals have been defined for this care plan. Generate a care plan to create condition-specific goals."
          iconType="no-data"
          size="sm"
          actionLabel={isAuthenticated ? 'Generate Care Plan' : undefined}
          onAction={isAuthenticated ? () => setGenerateConfirmOpen(true) : undefined}
          actionVariant="primary"
        />
      );
    }

    const activeGoals = carePlan.goals.filter((g) => g.status === 'active');
    const onHoldGoals = carePlan.goals.filter((g) => g.status === 'on_hold');
    const completedGoals = carePlan.goals.filter((g) => g.status === 'completed');
    const cancelledGoals = carePlan.goals.filter((g) => g.status === 'cancelled');

    return (
      <div className="space-y-4">
        {/* Progress Bar */}
        <GoalProgressBar
          completed={goalStats.completed}
          total={goalStats.total}
        />

        {/* Goal Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
            <span className="text-[10px] font-medium text-blue-700">{goalStats.active} active</span>
          </div>
          {goalStats.completed > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-green-700">{goalStats.completed} completed</span>
            </div>
          )}
          {goalStats.onHold > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-yellow-700">{goalStats.onHold} on hold</span>
            </div>
          )}
        </div>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Active Goals ({activeGoals.length})
            </p>
            <div className="space-y-2">
              {activeGoals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onStatusChange={handleGoalStatusChange}
                  disabled={!isAuthenticated}
                />
              ))}
            </div>
          </div>
        )}

        {/* On Hold Goals */}
        {onHoldGoals.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              On Hold ({onHoldGoals.length})
            </p>
            <div className="space-y-2">
              {onHoldGoals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onStatusChange={handleGoalStatusChange}
                  disabled={!isAuthenticated}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Completed ({completedGoals.length})
            </p>
            <div className="space-y-2">
              {completedGoals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onStatusChange={handleGoalStatusChange}
                  disabled={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cancelled Goals */}
        {cancelledGoals.length > 0 && !compact && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Cancelled ({cancelledGoals.length})
            </p>
            <div className="space-y-2">
              {cancelledGoals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onStatusChange={handleGoalStatusChange}
                  disabled={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Care Team tab content.
   */
  function renderCareTeamTab() {
    return (
      <div className="space-y-4">
        <CareTeamDisplay
          careManagerAssignment={careManagerAssignment}
          member={member}
          carePlan={carePlan}
        />

        {/* Care Plan Info */}
        {carePlan && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Care Plan ID</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={carePlan.id}>
                {carePlan.id ? carePlan.id.substring(0, 16) + '…' : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Condition</p>
              <p className="text-xs text-gray-700 mt-0.5 truncate">
                {conditionCategoryLabel || '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
              <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(carePlan.status || 'unknown')}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
              <p className="text-xs text-gray-700 mt-0.5">
                {carePlan.effectiveDate ? formatDate(carePlan.effectiveDate) : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Next Review</p>
              <p className="text-xs text-gray-700 mt-0.5">
                {carePlan.nextReviewDate ? formatDate(carePlan.nextReviewDate) : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created</p>
              <p className="text-xs text-gray-700 mt-0.5">
                {carePlan.createdAt ? formatRelativeTime(carePlan.createdAt) : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {carePlan && carePlan.notes && typeof carePlan.notes === 'string' && carePlan.notes.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {carePlan.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Tasks & Alerts tab content.
   */
  function renderTasksAlertsTab() {
    const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);
    const acknowledgedAlerts = alerts.filter((a) => a.acknowledged);

    return (
      <div className="space-y-4">
        {/* Unacknowledged Alerts */}
        {showAlerts && unacknowledgedAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Active Alerts ({unacknowledgedAlerts.length})
              </p>
              {alertStats.critical > 0 && (
                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {alertStats.critical} critical
                </span>
              )}
            </div>
            <div className="space-y-2">
              {unacknowledgedAlerts.slice(0, 5).map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledgeAlert}
                  disabled={!isAuthenticated}
                />
              ))}
              {unacknowledgedAlerts.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center">
                  +{unacknowledgedAlerts.length - 5} more alert(s)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pending Tasks */}
        {showTasks && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pending Tasks ({pendingTasks.length})
              </p>
              {taskStats.overdue > 0 && (
                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {taskStats.overdue} overdue
                </span>
              )}
            </div>
            {pendingTasks.length > 0 ? (
              <div>
                {pendingTasks.slice(0, 10).map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    disabled={!isAuthenticated}
                  />
                ))}
                {pendingTasks.length > 10 && (
                  <p className="text-[10px] text-gray-400 text-center pt-2">
                    +{pendingTasks.length - 10} more task(s)
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <p className="text-xs text-gray-400">No pending tasks.</p>
              </div>
            )}
          </div>
        )}

        {/* Completed Tasks */}
        {showTasks && completedTasks.length > 0 && !compact && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Completed Tasks ({completedTasks.length})
            </p>
            <div>
              {completedTasks.slice(0, 5).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleCompleteTask}
                  disabled={true}
                />
              ))}
              {completedTasks.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center pt-2">
                  +{completedTasks.length - 5} more completed task(s)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Acknowledged Alerts */}
        {showAlerts && acknowledgedAlerts.length > 0 && !compact && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Acknowledged Alerts ({acknowledgedAlerts.length})
            </p>
            <div className="space-y-2">
              {acknowledgedAlerts.slice(0, 3).map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledgeAlert}
                  disabled={true}
                />
              ))}
              {acknowledgedAlerts.length > 3 && (
                <p className="text-[10px] text-gray-400 text-center">
                  +{acknowledgedAlerts.length - 3} more acknowledged alert(s)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state for both */}
        {showTasks && showAlerts && pendingTasks.length === 0 && unacknowledgedAlerts.length === 0 && (
          <EmptyState
            title="All Clear"
            description="No pending tasks or active alerts for this member."
            iconType="no-data"
            size="sm"
          />
        )}
      </div>
    );
  }

  /**
   * Renders the Timeline tab content.
   */
  function renderTimelineTab() {
    if (careEvents.length === 0) {
      return (
        <EmptyState
          title="No Care Events"
          description="No care management events have been recorded for this member."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="py-2">
        {careEvents.slice(0, 15).map((event, index) => (
          <CareEventTimelineItem
            key={event.id || `event-${index}`}
            event={event}
            isLast={index === Math.min(careEvents.length, 15) - 1}
          />
        ))}
        {careEvents.length > 15 && (
          <p className="text-[10px] text-gray-400 text-center pt-2">
            Showing 15 of {careEvents.length} events
          </p>
        )}
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'goals',
        label: 'Goals',
        badge: carePlan && Array.isArray(carePlan.goals) && carePlan.goals.length > 0
          ? String(carePlan.goals.length)
          : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        content: !loading && !error ? renderGoalsTab() : null,
      },
    ];

    if (showCareTeam) {
      tabList.push({
        key: 'care_team',
        label: 'Care Team',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: !loading && !error ? renderCareTeamTab() : null,
      });
    }

    if (showTasks || showAlerts) {
      const badgeCount = taskStats.pending + alertStats.unacknowledged;
      tabList.push({
        key: 'tasks_alerts',
        label: 'Tasks & Alerts',
        badge: badgeCount > 0 ? String(badgeCount) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        content: !loading && !error ? renderTasksAlertsTab() : null,
      });
    }

    if (showTimeline) {
      tabList.push({
        key: 'timeline',
        label: 'Timeline',
        badge: careEvents.length > 0 ? String(careEvents.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: !loading && !error ? renderTimelineTab() : null,
      });
    }

    return tabList;
  }, [carePlan, loading, error, careEvents, tasks, alerts, taskStats, alertStats, careManagerAssignment, member, conditionCategoryLabel, goalStats, showCareTeam, showTasks, showAlerts, showTimeline, isAuthenticated, handleGoalStatusChange, handleCompleteTask, handleAcknowledgeAlert, compact]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
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
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-csnp-primary">
                Care Plan
              </h3>
              {member && (
                <p className="text-xs text-gray-500">
                  {member.firstName} {member.lastName}
                  {conditionCategoryLabel && ` · ${conditionCategoryLabel}`}
                  {carePlan && ` · ${toTitleCase(carePlan.status || 'unknown')}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Generate Care Plan */}
            {showActions && isAuthenticated && !carePlan && !loading && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setGenerateConfirmOpen(true)}
                loading={generating}
                loadingText="Generating..."
                disabled={generating}
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                }
              >
                Generate Care Plan
              </Button>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadCarePlanData}
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
      )}

      {/* Loading State */}
      {loading && (
        <CarePlanViewSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load care plan data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadCarePlanData}
          actionVariant="outline"
        />
      )}

      {/* No Care Plan State */}
      {!loading && !error && !carePlan && (
        <div className="space-y-4">
          <EmptyState
            title="No Active Care Plan"
            description={member
              ? `${member.firstName} ${member.lastName} does not have an active care plan. Generate a care plan to create condition-specific goals and interventions.`
              : 'This member does not have an active care plan.'}
            iconType="no-data"
            size="sm"
            actionLabel={isAuthenticated ? 'Generate Care Plan' : undefined}
            onAction={isAuthenticated ? () => setGenerateConfirmOpen(true) : undefined}
            actionVariant="primary"
            actionIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          />

          {/* Show timeline even without care plan */}
          {showTimeline && careEvents.length > 0 && (
            <Card bordered={true} flat={false}>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-csnp-primary">
                  Care Event History ({careEvents.length})
                </p>
                {renderTimelineTab()}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Care Plan Data */}
      {!loading && !error && carePlan && (
        <>
          {/* Summary Stats */}
          {!compact && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Total Goals</p>
                <p className="text-lg font-bold text-blue-700">{goalStats.total}</p>
                <p className="text-[10px] text-blue-500">{goalStats.active} active</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Completed</p>
                <p className="text-lg font-bold text-green-700">{goalStats.completed}</p>
                <p className="text-[10px] text-green-500">
                  {goalStats.total > 0 ? Math.round((goalStats.completed / goalStats.total) * 100) : 0}% done
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Pending Tasks</p>
                <p className={`text-lg font-bold ${taskStats.overdue > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                  {taskStats.pending}
                </p>
                <p className="text-[10px] text-yellow-500">
                  {taskStats.overdue > 0 ? `${taskStats.overdue} overdue` : 'on track'}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">Active Alerts</p>
                <p className={`text-lg font-bold ${alertStats.critical > 0 ? 'text-red-700' : 'text-orange-700'}`}>
                  {alertStats.unacknowledged}
                </p>
                <p className="text-[10px] text-orange-500">
                  {alertStats.critical > 0 ? `${alertStats.critical} critical` : 'none critical'}
                </p>
              </div>
            </div>
          )}

          {/* Overdue Tasks Alert */}
          {taskStats.overdue > 0 && (
            <Alert
              variant="warning"
              title={`${taskStats.overdue} Overdue Task${taskStats.overdue !== 1 ? 's' : ''}`}
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              {taskStats.overdue === 1
                ? '1 task is past its due date. Please review and complete or reschedule.'
                : `${taskStats.overdue} tasks are past their due dates. Please review and complete or reschedule.`}
            </Alert>
          )}

          {/* Critical Alerts */}
          {alertStats.critical > 0 && (
            <Alert
              variant="error"
              title={`${alertStats.critical} Critical Alert${alertStats.critical !== 1 ? 's' : ''}`}
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              Immediate attention required for critical care management alerts.
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="goals"
            variant="underline"
            size="sm"
            className="mb-4"
          />

          {/* Action Buttons */}
          {showActions && isAuthenticated && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Generate New Care Plan */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setGenerateConfirmOpen(true)}
                    loading={generating}
                    loadingText="Generating..."
                    disabled={generating}
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
                    Regenerate Plan
                  </Button>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{goalStats.total} goal{goalStats.total !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{taskStats.pending} task{taskStats.pending !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{alertStats.unacknowledged} alert{alertStats.unacknowledged !== 1 ? 's' : ''}</span>
                  </div>
                  <StatusBadge
                    status={carePlan.status === 'active' ? 'active' : 'pending'}
                    label={toTitleCase(carePlan.status || 'unknown')}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* CMS Compliance Notice */}
          {!compact && (
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
                  C-SNP care plans must include condition-specific goals, interventions, and measurable outcomes
                  per 42 CFR §422.101. Care plans must be reviewed at least quarterly and updated based on
                  member health status changes. All care plan activities are tracked in the audit trail.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Care Plan Confirm Dialog */}
      <ConfirmDialog
        isOpen={generateConfirmOpen}
        onClose={() => setGenerateConfirmOpen(false)}
        onConfirm={handleGenerateCarePlan}
        title={carePlan ? 'Regenerate Care Plan' : 'Generate Care Plan'}
        message={carePlan
          ? `Are you sure you want to generate a new care plan for ${member ? `${member.firstName} ${member.lastName}` : 'this member'}? The current active care plan will remain but a new one will be created with updated goals based on the member's condition category.`
          : `Generate an individualized care plan for ${member ? `${member.firstName} ${member.lastName}` : 'this member'}? The care plan will include condition-specific goals and interventions based on their chronic condition category.`}
        confirmText={carePlan ? 'Regenerate' : 'Generate'}
        cancelText="Cancel"
        variant="info"
        confirmLoading={generating}
      />
    </div>
  );
}

CarePlanView.propTypes = {
  memberId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showCareTeam: PropTypes.bool,
  showTimeline: PropTypes.bool,
  showTasks: PropTypes.bool,
  showAlerts: PropTypes.bool,
  showActions: PropTypes.bool,
  compact: PropTypes.bool,
  onCarePlanChange: PropTypes.func,
  className: PropTypes.string,
};

CarePlanView.defaultProps = {
  showHeader: true,
  showCareTeam: true,
  showTimeline: true,
  showTasks: true,
  showAlerts: true,
  showActions: true,
  compact: false,
  onCarePlanChange: undefined,
  className: '',
};