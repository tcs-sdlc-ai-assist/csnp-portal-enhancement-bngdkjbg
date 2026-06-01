import React from 'react';
import PropTypes from 'prop-types';

/**
 * Spinner size style mappings using Tailwind CSS classes.
 * @type {Object.<string, { container: string, spinner: string, text: string }>}
 */
const SIZE_STYLES = {
  xs: {
    container: '',
    spinner: 'w-4 h-4',
    text: 'text-xs',
  },
  sm: {
    container: '',
    spinner: 'w-6 h-6',
    text: 'text-xs',
  },
  md: {
    container: '',
    spinner: 'w-8 h-8',
    text: 'text-sm',
  },
  lg: {
    container: '',
    spinner: 'w-12 h-12',
    text: 'text-base',
  },
  xl: {
    container: '',
    spinner: 'w-16 h-16',
    text: 'text-lg',
  },
};

/**
 * Spinner color variant mappings using Tailwind CSS classes.
 * @type {Object.<string, { track: string, indicator: string, text: string }>}
 */
const VARIANT_STYLES = {
  primary: {
    track: 'text-csnp-blue-100',
    indicator: 'text-csnp-primary',
    text: 'text-csnp-primary',
  },
  secondary: {
    track: 'text-csnp-green-100',
    indicator: 'text-csnp-secondary',
    text: 'text-csnp-secondary',
  },
  white: {
    track: 'text-white/25',
    indicator: 'text-white',
    text: 'text-white',
  },
  gray: {
    track: 'text-gray-200',
    indicator: 'text-gray-500',
    text: 'text-gray-500',
  },
};

/**
 * Reusable loading spinner component with size variants, color variants,
 * optional loading text, and overlay/fullscreen modes. Used for async
 * operation feedback throughout the application.
 *
 * @param {Object} props
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md'] - Spinner size
 * @param {'primary'|'secondary'|'white'|'gray'} [props.variant='primary'] - Spinner color variant
 * @param {string} [props.text] - Optional loading text displayed below the spinner
 * @param {boolean} [props.overlay=false] - Whether to render as a centered overlay with semi-transparent background
 * @param {boolean} [props.fullScreen=false] - Whether to render as a full-screen centered overlay
 * @param {boolean} [props.inline=false] - Whether to render inline (no centering)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.ariaLabel='Loading'] - Aria label for accessibility
 * @returns {React.ReactElement}
 */
export default function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  text,
  overlay = false,
  fullScreen = false,
  inline = false,
  className = '',
  ariaLabel = 'Loading',
  ...rest
}) {
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES.md;
  const variantStyles = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  const hasText = typeof text === 'string' && text.trim().length > 0;

  /**
   * Renders the spinner SVG element.
   * @returns {React.ReactElement}
   */
  function renderSpinner() {
    return (
      <svg
        className={`animate-spin ${sizeStyles.spinner}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className={variantStyles.track}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className={variantStyles.indicator}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }

  /**
   * Renders the spinner content (spinner + optional text).
   * @returns {React.ReactElement}
   */
  function renderContent() {
    return (
      <div
        className={`flex flex-col items-center justify-center ${inline ? 'inline-flex' : ''}`}
        role="status"
        aria-label={ariaLabel}
      >
        {renderSpinner()}
        {hasText && (
          <p className={`mt-2 font-medium ${sizeStyles.text} ${variantStyles.text}`}>
            {text}
          </p>
        )}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80 ${className}`}
        {...rest}
      >
        {renderContent()}
      </div>
    );
  }

  if (overlay) {
    return (
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-70 rounded-2xl ${className}`}
        {...rest}
      >
        {renderContent()}
      </div>
    );
  }

  if (inline) {
    return (
      <span
        className={`inline-flex items-center gap-2 ${className}`}
        {...rest}
      >
        <span role="status" aria-label={ariaLabel}>
          {renderSpinner()}
          <span className="sr-only">{ariaLabel}</span>
        </span>
        {hasText && (
          <span className={`font-medium ${sizeStyles.text} ${variantStyles.text}`}>
            {text}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center justify-center py-8 ${className}`}
      {...rest}
    >
      {renderContent()}
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'white', 'gray']),
  text: PropTypes.string,
  overlay: PropTypes.bool,
  fullScreen: PropTypes.bool,
  inline: PropTypes.bool,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

LoadingSpinner.defaultProps = {
  size: 'md',
  variant: 'primary',
  text: undefined,
  overlay: false,
  fullScreen: false,
  inline: false,
  className: '',
  ariaLabel: 'Loading',
};