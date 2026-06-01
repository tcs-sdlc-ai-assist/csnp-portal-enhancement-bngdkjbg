import React from 'react';
import PropTypes from 'prop-types';

/**
 * Card size style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Card variant style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const VARIANT_STYLES = {
  default: 'bg-white',
  primary: 'bg-csnp-blue-50 border-csnp-blue-100',
  success: 'bg-csnp-alert-success-light border-green-200',
  warning: 'bg-csnp-alert-warning-light border-yellow-200',
  error: 'bg-csnp-alert-error-light border-red-200',
  info: 'bg-csnp-alert-info-light border-blue-200',
};

/**
 * Reusable card component with header, body, footer sections,
 * optional icon, and hover effects. Used for dashboard metrics
 * and detail views.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.children] - Card body content
 * @param {string} [props.title] - Card header title text
 * @param {string} [props.subtitle] - Card header subtitle text
 * @param {React.ReactNode} [props.icon] - Optional icon element rendered in the header
 * @param {React.ReactNode} [props.headerActions] - Optional action elements rendered in the header right side
 * @param {React.ReactNode} [props.footer] - Optional footer content
 * @param {'default'|'primary'|'success'|'warning'|'error'|'info'} [props.variant='default'] - Card visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Card padding size
 * @param {boolean} [props.hoverable=false] - Whether the card has hover shadow effect
 * @param {boolean} [props.bordered=true] - Whether the card has a border
 * @param {boolean} [props.flat=false] - Whether the card has no shadow
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Function} [props.onClick] - Click handler (makes the card clickable)
 * @param {string} [props.metric] - Large metric value to display prominently
 * @param {string} [props.metricLabel] - Label for the metric value
 * @param {'up'|'down'|'neutral'} [props.trend] - Trend direction for metric cards
 * @param {string} [props.trendValue] - Trend value text (e.g. "+12%")
 * @returns {React.ReactElement}
 */
export default function Card({
  children,
  title,
  subtitle,
  icon = null,
  headerActions = null,
  footer,
  variant = 'default',
  size = 'md',
  hoverable = false,
  bordered = true,
  flat = false,
  className = '',
  onClick,
  metric,
  metricLabel,
  trend,
  trendValue,
  ...rest
}) {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const isClickable = typeof onClick === 'function';

  const shadowClass = flat ? '' : 'shadow-card';
  const hoverClass = hoverable || isClickable ? 'hover:shadow-card-hover' : '';
  const cursorClass = isClickable ? 'cursor-pointer' : '';
  const borderClass = bordered ? 'border border-gray-200' : '';

  const cardClassName = [
    'rounded-2xl transition-shadow duration-200',
    variantClass,
    shadowClass,
    hoverClass,
    cursorClass,
    borderClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasHeader = title || subtitle || icon || headerActions;
  const hasMetric = typeof metric === 'string' && metric.length > 0;
  const hasFooter = footer !== undefined && footer !== null;

  /**
   * Returns the trend icon and color classes based on trend direction.
   * @param {'up'|'down'|'neutral'} direction - Trend direction
   * @returns {{ colorClass: string, icon: React.ReactElement }}
   */
  function getTrendDisplay(direction) {
    if (direction === 'up') {
      return {
        colorClass: 'text-green-600',
        icon: (
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
        ),
      };
    }

    if (direction === 'down') {
      return {
        colorClass: 'text-red-600',
        icon: (
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
        ),
      };
    }

    return {
      colorClass: 'text-gray-500',
      icon: (
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
      ),
    };
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
      {/* Header */}
      {hasHeader && (
        <div
          className={`flex items-start justify-between ${sizeClass} ${
            children || hasMetric || hasFooter ? 'pb-3 border-b border-gray-100' : ''
          }`}
        >
          <div className="flex items-start space-x-3 min-w-0 flex-1">
            {/* Icon */}
            {icon && (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
                {icon}
              </div>
            )}

            {/* Title and Subtitle */}
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-sm font-semibold text-csnp-primary truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Header Actions */}
          {headerActions && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Metric Display */}
      {hasMetric && (
        <div className={`${sizeClass} ${hasHeader ? 'pt-3' : ''} ${children || hasFooter ? 'pb-3' : ''}`}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-tight">
                {metric}
              </p>
              {metricLabel && (
                <p className="text-xs text-gray-500 mt-1">
                  {metricLabel}
                </p>
              )}
            </div>

            {/* Trend Indicator */}
            {trend && (
              <div className={`flex items-center gap-1 ${getTrendDisplay(trend).colorClass}`}>
                {getTrendDisplay(trend).icon}
                {trendValue && (
                  <span className="text-xs font-medium">
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {children && (
        <div
          className={`${sizeClass} ${hasHeader || hasMetric ? 'pt-3' : ''} ${
            hasFooter ? 'pb-3' : ''
          }`}
        >
          {children}
        </div>
      )}

      {/* Footer */}
      {hasFooter && (
        <div
          className={`${sizeClass} pt-3 border-t border-gray-100`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  headerActions: PropTypes.node,
  footer: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'error', 'info']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  hoverable: PropTypes.bool,
  bordered: PropTypes.bool,
  flat: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  metric: PropTypes.string,
  metricLabel: PropTypes.string,
  trend: PropTypes.oneOf(['up', 'down', 'neutral']),
  trendValue: PropTypes.string,
};

Card.defaultProps = {
  children: null,
  title: undefined,
  subtitle: undefined,
  icon: null,
  headerActions: null,
  footer: undefined,
  variant: 'default',
  size: 'md',
  hoverable: false,
  bordered: true,
  flat: false,
  className: '',
  onClick: undefined,
  metric: undefined,
  metricLabel: undefined,
  trend: undefined,
  trendValue: undefined,
};