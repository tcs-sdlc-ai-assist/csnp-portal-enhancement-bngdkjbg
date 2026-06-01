import React from 'react';
import PropTypes from 'prop-types';

/**
 * Trend direction style mappings using Tailwind CSS classes.
 * @type {Object.<string, { color: string, bgColor: string }>}
 */
const TREND_STYLES = {
  up: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  down: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  neutral: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
  },
};

/**
 * Icon background color variant mappings using Tailwind CSS classes.
 * @type {Object.<string, { bg: string, text: string }>}
 */
const ICON_VARIANT_STYLES = {
  primary: {
    bg: 'bg-csnp-blue-50',
    text: 'text-csnp-primary',
  },
  secondary: {
    bg: 'bg-csnp-green-50',
    text: 'text-csnp-secondary',
  },
  success: {
    bg: 'bg-csnp-alert-success-light',
    text: 'text-csnp-alert-success',
  },
  warning: {
    bg: 'bg-csnp-alert-warning-light',
    text: 'text-csnp-alert-warning',
  },
  error: {
    bg: 'bg-csnp-alert-error-light',
    text: 'text-csnp-alert-error',
  },
  info: {
    bg: 'bg-csnp-alert-info-light',
    text: 'text-csnp-alert-info',
  },
};

/**
 * Returns the trend arrow SVG icon element for a given direction.
 * @param {'up'|'down'|'neutral'} direction - The trend direction
 * @param {string} colorClass - The Tailwind text color class
 * @returns {React.ReactElement}
 */
function getTrendIcon(direction, colorClass) {
  if (direction === 'up') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClass}
        aria-hidden="true"
      >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }

  if (direction === 'down') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClass}
        aria-hidden="true"
      >
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </svg>
    );
  }

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={colorClass}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Dashboard statistics card component displaying a metric label, value,
 * trend indicator (up/down/neutral), percentage change, and icon with
 * color-coded background. Used on the dashboard for key performance
 * indicators and summary metrics.
 *
 * @param {Object} props
 * @param {string} props.label - Metric label text displayed above the value
 * @param {string|number} props.value - The metric value displayed prominently
 * @param {'up'|'down'|'neutral'} [props.trend] - Trend direction indicator
 * @param {string} [props.trendValue] - Trend value text (e.g. "+12%", "-3.5%")
 * @param {string} [props.trendLabel] - Additional trend context label (e.g. "vs last month")
 * @param {React.ReactNode} [props.icon] - Custom icon element rendered in the icon container
 * @param {'primary'|'secondary'|'success'|'warning'|'error'|'info'} [props.iconVariant='primary'] - Icon background color variant
 * @param {string} [props.description] - Optional description text below the value
 * @param {boolean} [props.loading=false] - Whether the card is in a loading state
 * @param {boolean} [props.hoverable=true] - Whether the card has hover shadow effect
 * @param {Function} [props.onClick] - Click handler (makes the card clickable)
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function StatsCard({
  label,
  value,
  trend,
  trendValue,
  trendLabel,
  icon = null,
  iconVariant = 'primary',
  description,
  loading = false,
  hoverable = true,
  onClick,
  className = '',
  ...rest
}) {
  const isClickable = typeof onClick === 'function';
  const trendStyles = trend ? (TREND_STYLES[trend] || TREND_STYLES.neutral) : null;
  const iconStyles = ICON_VARIANT_STYLES[iconVariant] || ICON_VARIANT_STYLES.primary;

  const hasLabel = typeof label === 'string' && label.trim().length > 0;
  const hasValue = value !== null && value !== undefined;
  const hasTrend = trend && trendValue;
  const hasTrendLabel = typeof trendLabel === 'string' && trendLabel.trim().length > 0;
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  const hasIcon = icon !== null && icon !== undefined;

  const cardClassName = [
    'bg-white rounded-2xl border border-gray-200 p-6 transition-shadow duration-200',
    hoverable || isClickable ? 'hover:shadow-card-hover' : '',
    isClickable ? 'cursor-pointer' : '',
    'shadow-card',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * Renders the loading skeleton state.
   * @returns {React.ReactElement}
   */
  function renderSkeleton() {
    return (
      <div className={cardClassName} {...rest}>
        <div className="animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
              <div className="h-7 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
            <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0 ml-4" />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return renderSkeleton();
  }

  return (
    <div
      className={cardClassName}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      {...rest}
    >
      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Label */}
          {hasLabel && (
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
              {label}
            </p>
          )}

          {/* Value */}
          {hasValue && (
            <p className="mt-2 text-2xl font-bold text-gray-900 leading-tight truncate">
              {value}
            </p>
          )}

          {/* Trend Indicator */}
          {hasTrend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${trendStyles.bgColor} ${trendStyles.color}`}
              >
                {getTrendIcon(trend, trendStyles.color)}
                <span>{trendValue}</span>
              </span>
              {hasTrendLabel && (
                <span className="text-xs text-gray-400 truncate">
                  {trendLabel}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {hasDescription && !hasTrend && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed truncate">
              {description}
            </p>
          )}
          {hasDescription && hasTrend && (
            <p className="mt-1 text-xs text-gray-500 leading-relaxed truncate">
              {description}
            </p>
          )}
        </div>

        {/* Icon */}
        {hasIcon && (
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ml-4 ${iconStyles.bg} ${iconStyles.text}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

StatsCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  trend: PropTypes.oneOf(['up', 'down', 'neutral']),
  trendValue: PropTypes.string,
  trendLabel: PropTypes.string,
  icon: PropTypes.node,
  iconVariant: PropTypes.oneOf(['primary', 'secondary', 'success', 'warning', 'error', 'info']),
  description: PropTypes.string,
  loading: PropTypes.bool,
  hoverable: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

StatsCard.defaultProps = {
  trend: undefined,
  trendValue: undefined,
  trendLabel: undefined,
  icon: null,
  iconVariant: 'primary',
  description: undefined,
  loading: false,
  hoverable: true,
  onClick: undefined,
  className: '',
};