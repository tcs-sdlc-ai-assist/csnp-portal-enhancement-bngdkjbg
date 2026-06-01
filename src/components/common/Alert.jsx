import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Alert variant style mappings using Tailwind CSS classes.
 * @type {Object.<string, { bg: string, border: string, text: string, icon: string }>}
 */
const VARIANT_STYLES = {
  info: {
    bg: 'bg-csnp-alert-info-light',
    border: 'border-csnp-alert-info',
    text: 'text-blue-800',
    icon: 'text-csnp-alert-info',
    closeHover: 'hover:bg-blue-100',
  },
  success: {
    bg: 'bg-csnp-alert-success-light',
    border: 'border-csnp-alert-success',
    text: 'text-green-800',
    icon: 'text-csnp-alert-success',
    closeHover: 'hover:bg-green-100',
  },
  warning: {
    bg: 'bg-csnp-alert-warning-light',
    border: 'border-csnp-alert-warning',
    text: 'text-yellow-800',
    icon: 'text-csnp-alert-warning',
    closeHover: 'hover:bg-yellow-100',
  },
  error: {
    bg: 'bg-csnp-alert-error-light',
    border: 'border-csnp-alert-error',
    text: 'text-red-800',
    icon: 'text-csnp-alert-error',
    closeHover: 'hover:bg-red-100',
  },
};

/**
 * Alert size style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base',
};

/**
 * Icon size mappings per alert size.
 * @type {Object.<string, number>}
 */
const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

/**
 * Returns the default SVG icon element for a given variant.
 * @param {string} variant - The alert variant
 * @param {number} size - The icon size in pixels
 * @returns {React.ReactElement}
 */
function getDefaultIcon(variant, size) {
  switch (variant) {
    case 'info':
      return (
        <svg
          width={size}
          height={size}
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
      );
    case 'success':
      return (
        <svg
          width={size}
          height={size}
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
      );
    case 'warning':
      return (
        <svg
          width={size}
          height={size}
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
      );
    case 'error':
      return (
        <svg
          width={size}
          height={size}
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
      );
    default:
      return (
        <svg
          width={size}
          height={size}
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
      );
  }
}

/**
 * Reusable alert/notification component with variants (info, success, warning, error),
 * dismissible option, icon support, and auto-dismiss timer.
 *
 * @param {Object} props
 * @param {'info'|'success'|'warning'|'error'} [props.variant='info'] - Alert visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Alert size
 * @param {string} [props.title] - Alert title text
 * @param {React.ReactNode} [props.children] - Alert body content / message
 * @param {boolean} [props.dismissible=false] - Whether the alert can be dismissed
 * @param {Function} [props.onDismiss] - Callback when the alert is dismissed
 * @param {boolean} [props.showIcon=true] - Whether to show the variant icon
 * @param {React.ReactNode} [props.icon] - Custom icon element (overrides default variant icon)
 * @param {number} [props.autoDismiss=0] - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @param {boolean} [props.bordered=true] - Whether the alert has a left border accent
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.actions] - Optional action elements rendered at the end of the alert
 * @returns {React.ReactElement|null}
 */
export default function Alert({
  variant = 'info',
  size = 'md',
  title,
  children,
  dismissible = false,
  onDismiss,
  showIcon = true,
  icon = null,
  autoDismiss = 0,
  bordered = true,
  className = '',
  actions = null,
  ...rest
}) {
  const [visible, setVisible] = useState(true);
  const autoDismissTimerRef = useRef(null);

  /**
   * Handles dismissing the alert.
   */
  const handleDismiss = useCallback(() => {
    setVisible(false);

    if (autoDismissTimerRef.current !== null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [onDismiss]);

  /**
   * Sets up auto-dismiss timer if autoDismiss > 0.
   */
  useEffect(() => {
    if (typeof autoDismiss === 'number' && autoDismiss > 0 && visible) {
      autoDismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);
    }

    return () => {
      if (autoDismissTimerRef.current !== null) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [autoDismiss, visible, handleDismiss]);

  if (!visible) {
    return null;
  }

  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  const borderClass = bordered ? `border-l-4 ${styles.border}` : `border ${styles.border}`;

  const alertClassName = [
    'rounded-lg flex items-start',
    styles.bg,
    styles.text,
    borderClass,
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const hasBody = children !== null && children !== undefined;
  const hasActions = actions !== null && actions !== undefined;

  return (
    <div
      className={alertClassName}
      role="alert"
      {...rest}
    >
      {/* Icon */}
      {showIcon && (
        <div className={`flex-shrink-0 ${styles.icon} mr-3 mt-0.5`}>
          {icon || getDefaultIcon(variant, iconSize)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {hasTitle && (
          <p className="font-semibold leading-tight">
            {title}
          </p>
        )}
        {hasBody && (
          <div className={hasTitle ? 'mt-1' : ''}>
            {typeof children === 'string' ? (
              <p className="leading-relaxed">{children}</p>
            ) : (
              children
            )}
          </div>
        )}
        {hasActions && (
          <div className="mt-2 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Dismiss Button */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={`flex-shrink-0 ml-3 p-1 rounded-md ${styles.text} ${styles.closeHover} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current transition-colors duration-200`}
          aria-label="Dismiss alert"
        >
          <svg
            width={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
            height={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  title: PropTypes.string,
  children: PropTypes.node,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  showIcon: PropTypes.bool,
  icon: PropTypes.node,
  autoDismiss: PropTypes.number,
  bordered: PropTypes.bool,
  className: PropTypes.string,
  actions: PropTypes.node,
};

Alert.defaultProps = {
  variant: 'info',
  size: 'md',
  title: undefined,
  children: null,
  dismissible: false,
  onDismiss: undefined,
  showIcon: true,
  icon: null,
  autoDismiss: 0,
  bordered: true,
  className: '',
  actions: null,
};