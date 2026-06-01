import React from 'react';
import PropTypes from 'prop-types';

/**
 * Status variant style mappings using Tailwind CSS classes.
 * Each variant maps to background, text, and border colors.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string }>}
 */
const STATUS_STYLES = {
  active: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  approved: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  processing: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  in_review: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  paid: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  denied: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  cancelled: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
  },
  expired: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  disenrolled: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  submitted: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  partially_approved: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  appealed: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  voided: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
  },
  accepted: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  in_progress: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  eligible: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  ineligible: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  compliant: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  non_compliant: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  minor_issues: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  major_issues: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
};

/**
 * Default style for unrecognized statuses.
 * @type {{ bg: string, text: string, border: string, dot: string }}
 */
const DEFAULT_STYLE = {
  bg: 'bg-gray-100',
  text: 'text-gray-600',
  border: 'border-gray-200',
  dot: 'bg-gray-400',
};

/**
 * Badge size style mappings using Tailwind CSS classes.
 * @type {Object.<string, { badge: string, dot: string, text: string }>}
 */
const SIZE_STYLES = {
  sm: {
    badge: 'px-2 py-0.5',
    dot: 'w-1.5 h-1.5',
    text: 'text-[10px]',
  },
  md: {
    badge: 'px-2.5 py-1',
    dot: 'w-2 h-2',
    text: 'text-xs',
  },
  lg: {
    badge: 'px-3 py-1.5',
    dot: 'w-2.5 h-2.5',
    text: 'text-sm',
  },
};

/**
 * Formats a status string for display by replacing underscores and hyphens
 * with spaces and capitalizing each word.
 * @param {string} status - The raw status string
 * @returns {string} Formatted status label
 */
function formatStatusLabel(status) {
  if (typeof status !== 'string' || status.trim().length === 0) {
    return '';
  }

  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Reusable status badge component with color-coded variants for different
 * statuses. Supports multiple sizes, optional status dot indicator,
 * bordered variant, custom labels, and pulsing animation for active states.
 *
 * @param {Object} props
 * @param {string} props.status - The status value (maps to a color variant)
 * @param {string} [props.label] - Custom label text (defaults to formatted status)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Badge size
 * @param {boolean} [props.showDot=true] - Whether to show the status dot indicator
 * @param {boolean} [props.bordered=true] - Whether to show a border
 * @param {boolean} [props.pulse=false] - Whether to show a pulse animation on the dot
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function StatusBadge({
  status,
  label,
  size = 'md',
  showDot = true,
  bordered = true,
  pulse = false,
  className = '',
  ...rest
}) {
  const normalizedStatus =
    typeof status === 'string' ? status.trim().toLowerCase() : '';

  const styles = STATUS_STYLES[normalizedStatus] || DEFAULT_STYLE;
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES.md;

  const displayLabel =
    typeof label === 'string' && label.trim().length > 0
      ? label.trim()
      : formatStatusLabel(normalizedStatus);

  const badgeClassName = [
    'inline-flex items-center font-medium rounded-full whitespace-nowrap',
    styles.bg,
    styles.text,
    sizeStyles.badge,
    sizeStyles.text,
    bordered ? `border ${styles.border}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={badgeClassName} {...rest}>
      {showDot && (
        <span
          className={`flex-shrink-0 rounded-full ${styles.dot} ${sizeStyles.dot} ${
            pulse ? 'animate-pulse' : ''
          }`}
          aria-hidden="true"
        />
      )}
      {displayLabel && (
        <span className={showDot ? 'ml-1.5' : ''}>{displayLabel}</span>
      )}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showDot: PropTypes.bool,
  bordered: PropTypes.bool,
  pulse: PropTypes.bool,
  className: PropTypes.string,
};

StatusBadge.defaultProps = {
  label: undefined,
  size: 'md',
  showDot: true,
  bordered: true,
  pulse: false,
  className: '',
};