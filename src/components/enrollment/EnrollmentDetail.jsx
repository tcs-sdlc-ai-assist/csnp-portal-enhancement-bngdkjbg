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
  getEnrollmentById,
  approveEnrollment,
  rejectEnrollment,
  cancelEnrollment,
  disenrollMember,
  submitEnrollment,
} from '../../services/enrollmentService.js';
import { getEligibilityHistory } from '../../services/eligibilityService.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
  formatCurrency,
  formatAddress,
  calculateAge,
  maskSSN,
} from '../../utils/helpers.js';
import {
  ENROLLMENT_STATUSES,
  ENROLLMENT_CHANNEL_LABELS,
  PLAN_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
} from '../../utils/constants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Status to StatusBadge status mapping.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  [ENROLLMENT_STATUSES.PENDING]: 'pending',
  [ENROLLMENT_STATUSES.APPROVED]: 'approved',
  [ENROLLMENT_STATUSES.REJECTED]: 'rejected',
  [ENROLLMENT_STATUSES.CANCELLED]: 'cancelled',
  [ENROLLMENT_STATUSES.ACTIVE]: 'active',
  [ENROLLMENT_STATUSES.DISENROLLED]: 'disenrolled',
};

/**
 * Status to color mapping for the status banner.
 * @type {Object.<string, { bg: string, border: string }>}
 */
const STATUS_BANNER_STYLES = {
  [ENROLLMENT_STATUSES.ACTIVE]: { bg: 'bg-green-50', border: 'border-green-200' },
  [ENROLLMENT_STATUSES.APPROVED]: { bg: 'bg-blue-50', border: 'border-blue-200' },
  [ENROLLMENT_STATUSES.PENDING]: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
  [ENROLLMENT_STATUSES.REJECTED]: { bg: 'bg-red-50', border: 'border-red-200' },
  [ENROLLMENT_STATUSES.CANCELLED]: { bg: 'bg-gray-50', border: 'border-gray-200' },
  [ENROLLMENT_STATUSES.DISENROLLED]: { bg: 'bg-orange-50', border: 'border-orange-200' },
};

/**
 * Default banner style for unknown statuses.
 * @type {{ bg: string, border: string }}
 */
const DEFAULT_BANNER_STYLE = { bg: 'bg-gray-50', border: 'border-gray-200' };

/**
 * Builds a timeline of enrollment events from the enrollment record.
 * @param {Object} enrollment - The enrollment record
 * @returns {Object[]} Array of timeline event objects
 */
function buildEnrollmentTimeline(enrollment) {
  if (!enrollment || typeof enrollment !== 'object') {
    return [];
  }

  const events = [];

  if (enrollment.createdAt) {
    events.push({
      id: 'created',
      label: 'Application Created',
      description: `Enrollment application submitted via ${ENROLLMENT_CHANNEL_LABELS[enrollment.channel] || enrollment.channel || 'unknown'} channel`,
      date: enrollment.createdAt,
      icon: 'create',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    });
  }

  if (enrollment.applicationDate) {
    events.push({
      id: 'application',
      label: 'Application Date',
      description: `Application date recorded: ${formatDate(enrollment.applicationDate)}`,
      date: enrollment.applicationDate + 'T00:00:00.000Z',
      icon: 'submit',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    });
  }

  if (enrollment.vccValidation && typeof enrollment.vccValidation === 'object') {
    const vccValid = enrollment.vccValidation.valid;
    events.push({
      id: 'vcc',
      label: 'Document Validation (VCC)',
      description: vccValid
        ? 'All documents passed VCC validation'
        : 'VCC document validation found issues',
      date: enrollment.vccValidation.timestamp || enrollment.updatedAt,
      icon: vccValid ? 'approve' : 'deny',
      color: vccValid ? 'text-green-600' : 'text-red-600',
      bgColor: vccValid ? 'bg-green-50' : 'bg-red-50',
    });
  }

  if (enrollment.icoeEnrichment && typeof enrollment.icoeEnrichment === 'object') {
    events.push({
      id: 'icoe',
      label: 'Data Enrichment (ICoE)',
      description: enrollment.icoeEnrichment.success
        ? `${enrollment.icoeEnrichment.enrichedFields ? enrollment.icoeEnrichment.enrichedFields.length : 0} field(s) enriched`
        : 'Data enrichment was not successful',
      date: enrollment.icoeEnrichment.timestamp || enrollment.updatedAt,
      icon: 'update',
      color: 'text-csnp-primary',
      bgColor: 'bg-csnp-blue-50',
    });
  }

  if (enrollment.ikaSubmission && typeof enrollment.ikaSubmission === 'object') {
    events.push({
      id: 'ika',
      label: 'CMS Submission (IKA)',
      description: enrollment.ikaSubmission.success
        ? `Submitted to CMS. Transaction: ${enrollment.ikaSubmission.transactionId || 'N/A'}`
        : 'CMS submission failed',
      date: enrollment.ikaSubmission.timestamp || enrollment.updatedAt,
      icon: 'submit',
      color: enrollment.ikaSubmission.success ? 'text-blue-600' : 'text-red-600',
      bgColor: enrollment.ikaSubmission.success ? 'bg-blue-50' : 'bg-red-50',
    });
  }

  if (enrollment.trrResponse && typeof enrollment.trrResponse === 'object') {
    const accepted = enrollment.trrResponse.accepted;
    events.push({
      id: 'trr',
      label: 'CMS Response (TRR)',
      description: accepted
        ? `Enrollment accepted by CMS (${enrollment.trrResponse.responseCode || 'N/A'})`
        : `Enrollment rejected by CMS: ${enrollment.trrResponse.responseMessage || 'Unknown reason'}`,
      date: enrollment.trrResponse.timestamp || enrollment.updatedAt,
      icon: accepted ? 'approve' : 'deny',
      color: accepted ? 'text-green-600' : 'text-red-600',
      bgColor: accepted ? 'bg-green-50' : 'bg-red-50',
    });
  }

  if (enrollment.approvalDate) {
    events.push({
      id: 'approved',
      label: 'Enrollment Approved',
      description: `Enrollment approved on ${formatDate(enrollment.approvalDate)}`,
      date: enrollment.approvalDate + 'T00:00:00.000Z',
      icon: 'approve',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    });
  }

  if (enrollment.status === ENROLLMENT_STATUSES.ACTIVE && enrollment.effectiveDate) {
    events.push({
      id: 'active',
      label: 'Enrollment Active',
      description: `Enrollment became active on ${formatDate(enrollment.effectiveDate)}`,
      date: enrollment.effectiveDate + 'T00:00:00.000Z',
      icon: 'approve',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    });
  }

  if (enrollment.status === ENROLLMENT_STATUSES.REJECTED) {
    events.push({
      id: 'rejected',
      label: 'Enrollment Rejected',
      description: 'Enrollment application was rejected',
      date: enrollment.updatedAt,
      icon: 'deny',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    });
  }

  if (enrollment.status === ENROLLMENT_STATUSES.CANCELLED) {
    events.push({
      id: 'cancelled',
      label: 'Enrollment Cancelled',
      description: 'Enrollment application was cancelled',
      date: enrollment.updatedAt,
      icon: 'deny',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    });
  }

  if (enrollment.status === ENROLLMENT_STATUSES.DISENROLLED && enrollment.terminationDate) {
    events.push({
      id: 'disenrolled',
      label: 'Member Disenrolled',
      description: `Member disenrolled effective ${formatDate(enrollment.terminationDate)}`,
      date: enrollment.terminationDate + 'T00:00:00.000Z',
      icon: 'deny',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    });
  }

  // Sort by date ascending
  events.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    return dateA.getTime() - dateB.getTime();
  });

  return events;
}

/**
 * Timeline icon SVG paths by type.
 * @type {Object.<string, string>}
 */
const TIMELINE_ICON_PATHS = {
  create: 'M12 4v16m8-8H4',
  submit: 'M9 5l7 7-7 7',
  approve: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  deny: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  update: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
};

/**
 * Timeline event item component.
 *
 * @param {Object} props
 * @param {Object} props.event - The timeline event object
 * @param {boolean} [props.isLast=false] - Whether this is the last event
 * @returns {React.ReactElement}
 */
function TimelineItem({ event, isLast = false }) {
  const iconPath = TIMELINE_ICON_PATHS[event.icon] || TIMELINE_ICON_PATHS.update;

  return (
    <div className="flex items-start gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${event.bgColor} ${event.color}`}>
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
            <path d={iconPath} />
          </svg>
        </div>
        {!isLast && (
          <div className="w-0.5 h-full min-h-[24px] bg-gray-200 mt-1" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-900">{event.label}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2" title={formatDateTime(event.date)}>
            {formatRelativeTime(event.date)}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
          {event.description}
        </p>
      </div>
    </div>
  );
}

TimelineItem.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    bgColor: PropTypes.string.isRequired,
  }).isRequired,
  isLast: PropTypes.bool,
};

TimelineItem.defaultProps = {
  isLast: false,
};

/**
 * Skeleton loading state for the enrollment detail.
 * @returns {React.ReactElement}
 */
function EnrollmentDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-32 bg-gray-200 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-48 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Enrollment detail view component.
 * Shows full enrollment record with member info, channel, documents,
 * eligibility status, CMS submission status (IKA), TRR response,
 * timeline of enrollment events, and action buttons (approve, reject, resubmit).
 *
 * @param {Object} props
 * @param {string} props.enrollmentId - The enrollment ID to display
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showTimeline=true] - Whether to show the enrollment timeline
 * @param {Function} [props.onStatusChange] - Callback when enrollment status changes: (enrollment) => void
 * @param {Function} [props.onClose] - Callback when close/back is clicked
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function EnrollmentDetail({
  enrollmentId,
  showHeader = true,
  showActions = true,
  showTimeline = true,
  onStatusChange,
  onClose,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [enrollment, setEnrollment] = useState(null);
  const [member, setMember] = useState(null);
  const [benefitPackage, setBenefitPackage] = useState(null);
  const [eligibilityHistory, setEligibilityHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm dialogs
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [disenrollDialogOpen, setDisenrollDialogOpen] = useState(false);
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [disenrollReason, setDisenrollReason] = useState('');

  /**
   * Loads enrollment data and related records.
   */
  const loadEnrollmentData = useCallback(() => {
    if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
      setError('Enrollment ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const enrollmentRecord = getEnrollmentById(enrollmentId.trim());
      if (!enrollmentRecord) {
        setError(`Enrollment not found: ${enrollmentId.trim()}`);
        setLoading(false);
        return;
      }

      setEnrollment(enrollmentRecord);

      // Load member data
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const members = JSON.parse(storedMembers);
          if (Array.isArray(members)) {
            const foundMember = members.find((m) => m.id === enrollmentRecord.memberId);
            setMember(foundMember || null);
          }
        }
      } catch {
        // Silently fail
      }

      // Load benefit package
      try {
        const storedPackages = localStorage.getItem('csnp_benefit_packages');
        if (storedPackages) {
          const packages = JSON.parse(storedPackages);
          if (Array.isArray(packages)) {
            const foundPackage = packages.find((p) => p.id === enrollmentRecord.benefitPackageId);
            setBenefitPackage(foundPackage || null);
          }
        }
      } catch {
        // Silently fail
      }

      // Load eligibility history
      if (enrollmentRecord.memberId) {
        try {
          const history = getEligibilityHistory(enrollmentRecord.memberId);
          setEligibilityHistory(Array.isArray(history) ? history : []);
        } catch {
          setEligibilityHistory([]);
        }
      }
    } catch (err) {
      console.error('EnrollmentDetail: failed to load enrollment data:', err);
      setError('Unable to load enrollment details');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadEnrollmentData();
  }, [loadEnrollmentData]);

  /**
   * Handles approving the enrollment.
   */
  const handleApprove = useCallback(() => {
    setActionLoading(true);
    setApproveDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const result = approveEnrollment(enrollmentId, performedBy);

      if (result.success) {
        addNotification('success', 'Enrollment Approved', `Enrollment has been approved and activated.`);
        loadEnrollmentData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification('error', 'Approval Failed', result.error || 'An error occurred while approving the enrollment.');
      }
    } catch (err) {
      console.error('EnrollmentDetail: approve error:', err);
      addNotification('error', 'Approval Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [enrollmentId, user, addNotification, loadEnrollmentData, onStatusChange]);

  /**
   * Handles rejecting the enrollment.
   */
  const handleReject = useCallback(() => {
    setActionLoading(true);
    setRejectDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const result = rejectEnrollment(enrollmentId, rejectReason, performedBy);

      if (result.success) {
        addNotification('warning', 'Enrollment Rejected', `Enrollment has been rejected.`);
        setRejectReason('');
        loadEnrollmentData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification('error', 'Rejection Failed', result.error || 'An error occurred while rejecting the enrollment.');
      }
    } catch (err) {
      console.error('EnrollmentDetail: reject error:', err);
      addNotification('error', 'Rejection Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [enrollmentId, rejectReason, user, addNotification, loadEnrollmentData, onStatusChange]);

  /**
   * Handles cancelling the enrollment.
   */
  const handleCancel = useCallback(() => {
    setActionLoading(true);
    setCancelDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const result = cancelEnrollment(enrollmentId, cancelReason, performedBy);

      if (result.success) {
        addNotification('info', 'Enrollment Cancelled', `Enrollment has been cancelled.`);
        setCancelReason('');
        loadEnrollmentData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification('error', 'Cancellation Failed', result.error || 'An error occurred while cancelling the enrollment.');
      }
    } catch (err) {
      console.error('EnrollmentDetail: cancel error:', err);
      addNotification('error', 'Cancellation Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [enrollmentId, cancelReason, user, addNotification, loadEnrollmentData, onStatusChange]);

  /**
   * Handles disenrolling the member.
   */
  const handleDisenroll = useCallback(() => {
    setActionLoading(true);
    setDisenrollDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const terminationDate = new Date().toISOString().split('T')[0];
      const result = disenrollMember(enrollmentId, disenrollReason, terminationDate, performedBy);

      if (result.success) {
        addNotification('warning', 'Member Disenrolled', `Member has been disenrolled from this enrollment.`);
        setDisenrollReason('');
        loadEnrollmentData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification('error', 'Disenrollment Failed', result.error || 'An error occurred while disenrolling the member.');
      }
    } catch (err) {
      console.error('EnrollmentDetail: disenroll error:', err);
      addNotification('error', 'Disenrollment Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [enrollmentId, disenrollReason, user, addNotification, loadEnrollmentData, onStatusChange]);

  /**
   * Handles resubmitting the enrollment for CMS processing.
   */
  const handleResubmit = useCallback(() => {
    setActionLoading(true);
    setResubmitDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const result = submitEnrollment(enrollmentId, { performedBy, skipVCC: true });

      if (result.success) {
        addNotification('success', 'Enrollment Resubmitted', `Enrollment has been resubmitted for CMS processing. Status: ${toTitleCase(result.status)}`);
        loadEnrollmentData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification('error', 'Resubmission Failed', result.error || 'An error occurred while resubmitting the enrollment.');
      }
    } catch (err) {
      console.error('EnrollmentDetail: resubmit error:', err);
      addNotification('error', 'Resubmission Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [enrollmentId, user, addNotification, loadEnrollmentData, onStatusChange]);

  /**
   * Computed: enrollment timeline events.
   */
  const timelineEvents = useMemo(() => {
    return buildEnrollmentTimeline(enrollment);
  }, [enrollment]);

  /**
   * Computed: member display name.
   */
  const memberName = useMemo(() => {
    if (!member) {
      return enrollment ? (enrollment.memberId ? enrollment.memberId.substring(0, 12) + '…' : '—') : '—';
    }
    return `${member.firstName || ''} ${member.lastName || ''}`.trim() || '—';
  }, [member, enrollment]);

  /**
   * Computed: channel label.
   */
  const channelLabel = useMemo(() => {
    if (!enrollment) return '—';
    return ENROLLMENT_CHANNEL_LABELS[enrollment.channel] || toTitleCase(enrollment.channel || '');
  }, [enrollment]);

  /**
   * Computed: plan type label.
   */
  const planTypeLabel = useMemo(() => {
    if (!enrollment) return '—';
    return PLAN_TYPE_LABELS[enrollment.planType] || enrollment.planType || '—';
  }, [enrollment]);

  /**
   * Computed: badge status.
   */
  const badgeStatus = useMemo(() => {
    if (!enrollment) return 'pending';
    return STATUS_BADGE_MAP[enrollment.status] || 'pending';
  }, [enrollment]);

  /**
   * Computed: banner style.
   */
  const bannerStyle = useMemo(() => {
    if (!enrollment) return DEFAULT_BANNER_STYLE;
    return STATUS_BANNER_STYLES[enrollment.status] || DEFAULT_BANNER_STYLE;
  }, [enrollment]);

  /**
   * Computed: diagnosis codes from enrollment.
   */
  const diagnosisCodes = useMemo(() => {
    if (!enrollment) return [];
    return Array.isArray(enrollment.diagnosisCodesVerified) ? enrollment.diagnosisCodesVerified : [];
  }, [enrollment]);

  /**
   * Computed: documents from enrollment.
   */
  const documents = useMemo(() => {
    if (!enrollment) return [];
    return Array.isArray(enrollment.documents) ? enrollment.documents : [];
  }, [enrollment]);

  /**
   * Computed: whether actions are available based on enrollment status.
   */
  const canApprove = useMemo(() => {
    if (!enrollment) return false;
    return enrollment.status === ENROLLMENT_STATUSES.PENDING || enrollment.status === ENROLLMENT_STATUSES.APPROVED;
  }, [enrollment]);

  const canReject = useMemo(() => {
    if (!enrollment) return false;
    return enrollment.status === ENROLLMENT_STATUSES.PENDING;
  }, [enrollment]);

  const canCancel = useMemo(() => {
    if (!enrollment) return false;
    return enrollment.status === ENROLLMENT_STATUSES.PENDING || enrollment.status === ENROLLMENT_STATUSES.APPROVED;
  }, [enrollment]);

  const canDisenroll = useMemo(() => {
    if (!enrollment) return false;
    return enrollment.status === ENROLLMENT_STATUSES.ACTIVE || enrollment.status === ENROLLMENT_STATUSES.APPROVED;
  }, [enrollment]);

  const canResubmit = useMemo(() => {
    if (!enrollment) return false;
    return enrollment.status === ENROLLMENT_STATUSES.PENDING;
  }, [enrollment]);

  /**
   * Computed: CMS submission details.
   */
  const hasCMSResponse = useMemo(() => {
    return enrollment && enrollment.trrResponse && typeof enrollment.trrResponse === 'object';
  }, [enrollment]);

  const hasIKASubmission = useMemo(() => {
    return enrollment && enrollment.ikaSubmission && typeof enrollment.ikaSubmission === 'object';
  }, [enrollment]);

  const hasVCCValidation = useMemo(() => {
    return enrollment && enrollment.vccValidation && typeof enrollment.vccValidation === 'object';
  }, [enrollment]);

  const hasICoEEnrichment = useMemo(() => {
    return enrollment && enrollment.icoeEnrichment && typeof enrollment.icoeEnrichment === 'object';
  }, [enrollment]);

  /**
   * Computed: latest eligibility record.
   */
  const latestEligibility = useMemo(() => {
    if (eligibilityHistory.length === 0) return null;
    return eligibilityHistory[0];
  }, [eligibilityHistory]);

  /**
   * Computed: member condition category label.
   */
  const conditionCategoryLabel = useMemo(() => {
    if (member && member.conditionCategory) {
      return CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory);
    }
    return null;
  }, [member]);

  const hasEnrollmentId = typeof enrollmentId === 'string' && enrollmentId.trim().length > 0;

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (!hasEnrollmentId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Enrollment Selected"
          description="Select an enrollment to view its details."
          iconType="no-data"
          size="sm"
        />
      </div>
    );
  }

  /**
   * Renders the Overview tab content.
   */
  function renderOverviewTab() {
    return (
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${bannerStyle.bg} ${bannerStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={badgeStatus}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {toTitleCase(enrollment.status || 'unknown')}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(enrollment.createdAt)}
            </span>
          </div>
        </div>

        {/* Enrollment Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Enrollment ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={enrollment.id}>
              {enrollment.id ? enrollment.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={memberName}>
              {memberName}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Channel</p>
            <p className="text-xs text-gray-700 mt-0.5">{channelLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{planTypeLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Benefit Package</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={benefitPackage ? benefitPackage.name : ''}>
              {benefitPackage ? benefitPackage.name : enrollment.benefitPackageId ? enrollment.benefitPackageId.substring(0, 12) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.effectiveDate ? formatDate(enrollment.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Application Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.applicationDate ? formatDate(enrollment.applicationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Approval Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.approvalDate ? formatDate(enrollment.approvalDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.terminationDate ? formatDate(enrollment.terminationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.processedBy || 'System'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.createdAt ? formatDateTime(enrollment.createdAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Updated</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {enrollment.updatedAt ? formatDateTime(enrollment.updatedAt) : '—'}
            </p>
          </div>
        </div>

        {/* APPIN */}
        {enrollment.appin && (
          <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-csnp-primary flex-shrink-0"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] text-csnp-blue-700 uppercase tracking-wider font-semibold">Application ID (APPIN)</p>
                <p className="text-xs font-mono font-semibold text-csnp-primary mt-0.5">{enrollment.appin}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {enrollment.notes && typeof enrollment.notes === 'string' && enrollment.notes.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {enrollment.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Member Info tab content.
   */
  function renderMemberTab() {
    if (!member) {
      return (
        <EmptyState
          title="Member Data Not Available"
          description="Member information could not be loaded for this enrollment."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-4">
        {/* Member Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Name</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {member.firstName} {member.lastName}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={member.id}>
              {member.id ? member.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Date of Birth</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {member.dateOfBirth ? `${formatDate(member.dateOfBirth)} (Age ${calculateAge(member.dateOfBirth) || '—'})` : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Gender</p>
            <p className="text-xs text-gray-700 mt-0.5">{member.gender || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">SSN</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{member.ssn || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Medicare ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{member.medicareId || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">CCID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{member.ccid || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Email</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={member.email}>
              {member.email || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Phone</p>
            <p className="text-xs text-gray-700 mt-0.5">{member.phone || '—'}</p>
          </div>
        </div>

        {/* Address */}
        {member.address && typeof member.address === 'object' && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Address</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {formatAddress(member.address) || '—'}
            </p>
          </div>
        )}

        {/* Condition Category */}
        {conditionCategoryLabel && (
          <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-csnp-primary flex-shrink-0"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] text-csnp-blue-700 uppercase tracking-wider font-semibold">Primary Condition Category</p>
                <p className="text-xs font-semibold text-csnp-primary mt-0.5">{conditionCategoryLabel}</p>
              </div>
            </div>
          </div>
        )}

        {/* CSNP Eligibility */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">CSNP Eligible:</span>
          {member.csnpEligible ? (
            <StatusBadge status="eligible" label="Eligible" size="sm" showDot={true} bordered={true} />
          ) : (
            <StatusBadge status="ineligible" label="Not Eligible" size="sm" showDot={true} bordered={true} />
          )}
        </div>

        {/* Diagnosis Codes */}
        {diagnosisCodes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Verified Diagnosis Codes ({diagnosisCodes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {diagnosisCodes.map((code) => {
                const entry = getCodeByICD10(code);
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      entry && entry.csnpEligible
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                    title={entry ? entry.description : code}
                  >
                    {code}
                    {entry && (
                      <span className="opacity-75 max-w-[120px] truncate">{entry.description}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Latest Eligibility */}
        {latestEligibility && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Latest Eligibility Validation
            </p>
            <div className={`p-3 rounded-lg border ${latestEligibility.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={latestEligibility.eligible ? 'eligible' : 'ineligible'}
                    size="sm"
                    showDot={true}
                    bordered={true}
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {latestEligibility.eligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {formatRelativeTime(latestEligibility.createdAt)}
                </span>
              </div>
              {latestEligibility.priorityCondition && (
                <p className="text-xs text-gray-600 mt-1">
                  Priority Condition: <strong>{latestEligibility.priorityCondition}</strong>
                  {latestEligibility.priorityCategory && (
                    <span> ({CONDITION_CATEGORY_LABELS[latestEligibility.priorityCategory] || toTitleCase(latestEligibility.priorityCategory)})</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the CMS & Documents tab content.
   */
  function renderCMSTab() {
    return (
      <div className="space-y-4">
        {/* IKA CMS Submission */}
        {hasIKASubmission && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              CMS Submission (IKA)
            </p>
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <div className="grid grid-cols-2 gap-2">
                {enrollment.ikaSubmission.transactionId && (
                  <div>
                    <p className="text-[10px] text-gray-400">Transaction ID</p>
                    <p className="text-xs font-mono text-gray-700 truncate" title={enrollment.ikaSubmission.transactionId}>
                      {enrollment.ikaSubmission.transactionId}
                    </p>
                  </div>
                )}
                {enrollment.ikaSubmission.status && (
                  <div>
                    <p className="text-[10px] text-gray-400">Status</p>
                    <p className="text-xs text-gray-700">{toTitleCase(enrollment.ikaSubmission.status)}</p>
                  </div>
                )}
                {enrollment.ikaSubmission.timestamp && (
                  <div>
                    <p className="text-[10px] text-gray-400">Submitted At</p>
                    <p className="text-xs text-gray-700">{formatDateTime(enrollment.ikaSubmission.timestamp)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!hasIKASubmission && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 text-center">No CMS submission (IKA) recorded for this enrollment.</p>
          </div>
        )}

        {/* TRR Response */}
        {hasCMSResponse && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              CMS Response (TRR)
            </p>
            <div className={`p-3 rounded-lg border ${
              enrollment.trrResponse.accepted
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${
                  enrollment.trrResponse.accepted ? 'text-green-800' : 'text-red-800'
                }`}>
                  {enrollment.trrResponse.accepted ? 'Accepted' : 'Rejected'}
                </span>
                {enrollment.trrResponse.responseCode && (
                  <span className="text-[10px] font-mono text-gray-500">
                    {enrollment.trrResponse.responseCode}
                  </span>
                )}
              </div>
              {enrollment.trrResponse.responseMessage && (
                <p className="text-xs text-gray-600">
                  {enrollment.trrResponse.responseMessage}
                </p>
              )}
              {enrollment.trrResponse.timestamp && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Received: {formatDateTime(enrollment.trrResponse.timestamp)}
                </p>
              )}
            </div>
          </div>
        )}

        {!hasCMSResponse && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 text-center">No CMS response (TRR) received for this enrollment.</p>
          </div>
        )}

        {/* VCC Document Validation */}
        {hasVCCValidation && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Document Validation (VCC)
            </p>
            <div className={`p-3 rounded-lg border ${
              enrollment.vccValidation.valid
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <span className={`text-xs font-semibold ${
                enrollment.vccValidation.valid ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {enrollment.vccValidation.valid ? 'All Documents Valid' : 'Validation Issues Found'}
              </span>
              {Array.isArray(enrollment.vccValidation.results) && enrollment.vccValidation.results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {enrollment.vccValidation.results.map((result, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        result.valid ? 'bg-green-500' : 'bg-red-500'
                      }`} aria-hidden="true" />
                      <span className="text-gray-600 truncate">
                        {result.documentName}: {result.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ICoE Data Enrichment */}
        {hasICoEEnrichment && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Data Enrichment (ICoE)
            </p>
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-csnp-primary">
                  {enrollment.icoeEnrichment.success ? 'Enrichment Successful' : 'Enrichment Failed'}
                </span>
              </div>
              {Array.isArray(enrollment.icoeEnrichment.enrichedFields) && enrollment.icoeEnrichment.enrichedFields.length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] text-gray-500 mb-1">Enriched Fields:</p>
                  <div className="flex flex-wrap gap-1">
                    {enrollment.icoeEnrichment.enrichedFields.map((field) => (
                      <span
                        key={field}
                        className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-white text-csnp-primary rounded border border-csnp-blue-200"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Documents ({documents.length})
          </p>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id || `doc-${idx}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-csnp-primary flex-shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{doc.name || 'Unnamed Document'}</p>
                      <p className="text-[10px] text-gray-400">{doc.type || 'unknown'}</p>
                    </div>
                  </div>
                  {doc.valid !== undefined && (
                    <span className={`flex-shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      doc.valid
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${doc.valid ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {doc.valid ? 'Valid' : 'Invalid'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-400">No documents attached to this enrollment.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Renders the Timeline tab content.
   */
  function renderTimelineTab() {
    if (timelineEvents.length === 0) {
      return (
        <EmptyState
          title="No Timeline Events"
          description="No enrollment events have been recorded yet."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="py-2">
        {timelineEvents.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === timelineEvents.length - 1}
          />
        ))}
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
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
        content: enrollment ? renderOverviewTab() : null,
      },
      {
        key: 'member',
        label: 'Member Info',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: enrollment ? renderMemberTab() : null,
      },
      {
        key: 'cms',
        label: 'CMS & Documents',
        badge: hasCMSResponse ? (enrollment.trrResponse.accepted ? '✓' : '✗') : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: enrollment ? renderCMSTab() : null,
      },
    ];

    if (showTimeline) {
      tabList.push({
        key: 'timeline',
        label: 'Timeline',
        badge: timelineEvents.length > 0 ? String(timelineEvents.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: enrollment ? renderTimelineTab() : null,
      });
    }

    return tabList;
  }, [enrollment, member, benefitPackage, diagnosisCodes, documents, timelineEvents, latestEligibility, conditionCategoryLabel, hasCMSResponse, hasIKASubmission, hasVCCValidation, hasICoEEnrichment, showTimeline, bannerStyle, badgeStatus, channelLabel, planTypeLabel, memberName]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {typeof onClose === 'function' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
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
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                }
              >
                Back
              </Button>
            )}
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
                  <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-csnp-primary">
                  Enrollment Details
                </h3>
                {enrollment && (
                  <p className="text-xs text-gray-500">
                    {memberName} · {channelLabel} · {enrollment.appin || enrollment.id ? (enrollment.appin || enrollment.id.substring(0, 12) + '…') : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadEnrollmentData}
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
      )}

      {/* Loading State */}
      {loading && (
        <EnrollmentDetailSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load enrollment details"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadEnrollmentData}
          actionVariant="outline"
        />
      )}

      {/* Enrollment Data */}
      {!loading && !error && enrollment && (
        <>
          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="overview"
            variant="underline"
            size="sm"
            className="mb-4"
          />

          {/* Action Buttons */}
          {showActions && isAuthenticated && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                {/* Approve */}
                {canApprove && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setApproveDialogOpen(true)}
                    disabled={actionLoading}
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
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  >
                    Approve
                  </Button>
                )}

                {/* Reject */}
                {canReject && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={actionLoading}
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
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    }
                  >
                    Reject
                  </Button>
                )}

                {/* Resubmit to CMS */}
                {canResubmit && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setResubmitDialogOpen(true)}
                    disabled={actionLoading}
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
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  >
                    Submit to CMS
                  </Button>
                )}

                {/* Cancel */}
                {canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Cancel Enrollment
                  </Button>
                )}

                {/* Disenroll */}
                {canDisenroll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisenrollDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Disenroll Member
                  </Button>
                )}

                {/* Status Badge */}
                <div className="ml-auto flex-shrink-0">
                  <StatusBadge
                    status={badgeStatus}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve Confirm Dialog */}
      <ConfirmDialog
        isOpen={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        onConfirm={handleApprove}
        title="Approve Enrollment"
        message={`Are you sure you want to approve this enrollment for ${memberName}? The enrollment will be activated and the member will be enrolled in the selected benefit package.`}
        confirmText="Approve"
        cancelText="Cancel"
        variant="success"
        confirmLoading={actionLoading}
      />

      {/* Reject Confirm Dialog */}
      <ConfirmDialog
        isOpen={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={handleReject}
        title="Reject Enrollment"
        message={`Are you sure you want to reject this enrollment for ${memberName}? This action cannot be undone.`}
        confirmText="Reject"
        cancelText="Cancel"
        variant="danger"
        confirmLoading={actionLoading}
      >
        <div className="mt-3">
          <label htmlFor="reject-reason" className="text-xs font-medium text-gray-700 mb-1 block">
            Rejection Reason (optional)
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 resize-y"
          />
        </div>
      </ConfirmDialog>

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Enrollment"
        message={`Are you sure you want to cancel this enrollment for ${memberName}?`}
        confirmText="Cancel Enrollment"
        cancelText="Keep Enrollment"
        variant="warning"
        confirmLoading={actionLoading}
      >
        <div className="mt-3">
          <label htmlFor="cancel-reason" className="text-xs font-medium text-gray-700 mb-1 block">
            Cancellation Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancellation..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 resize-y"
          />
        </div>
      </ConfirmDialog>

      {/* Disenroll Confirm Dialog */}
      <ConfirmDialog
        isOpen={disenrollDialogOpen}
        onClose={() => setDisenrollDialogOpen(false)}
        onConfirm={handleDisenroll}
        title="Disenroll Member"
        message={`Are you sure you want to disenroll ${memberName} from this enrollment? The termination date will be set to today.`}
        confirmText="Disenroll"
        cancelText="Cancel"
        variant="danger"
        confirmLoading={actionLoading}
      >
        <div className="mt-3">
          <label htmlFor="disenroll-reason" className="text-xs font-medium text-gray-700 mb-1 block">
            Disenrollment Reason (optional)
          </label>
          <textarea
            id="disenroll-reason"
            value={disenrollReason}
            onChange={(e) => setDisenrollReason(e.target.value)}
            placeholder="Enter reason for disenrollment..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 resize-y"
          />
        </div>
      </ConfirmDialog>

      {/* Resubmit Confirm Dialog */}
      <ConfirmDialog
        isOpen={resubmitDialogOpen}
        onClose={() => setResubmitDialogOpen(false)}
        onConfirm={handleResubmit}
        title="Submit to CMS"
        message={`Are you sure you want to submit this enrollment for ${memberName} to CMS for processing? This will run the enrollment through the IKA submission workflow and process the TRR response.`}
        confirmText="Submit to CMS"
        cancelText="Cancel"
        variant="info"
        confirmLoading={actionLoading}
      />
    </div>
  );
}

EnrollmentDetail.propTypes = {
  enrollmentId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showActions: PropTypes.bool,
  showTimeline: PropTypes.bool,
  onStatusChange: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

EnrollmentDetail.defaultProps = {
  showHeader: true,
  showActions: true,
  showTimeline: true,
  onStatusChange: undefined,
  onClose: undefined,
  className: '',
};