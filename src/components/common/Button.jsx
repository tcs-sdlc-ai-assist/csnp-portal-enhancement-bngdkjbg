import React from 'react';
import PropTypes from 'prop-types';

/**
 * Button variant style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const VARIANT_STYLES = {
  primary:
    'bg-csnp-primary text-white hover:bg-csnp-primary-dark focus:ring-csnp-primary-light',
  secondary:
    'bg-csnp-secondary text-white hover:bg-csnp-secondary-dark focus:ring-csnp-secondary-light',
  danger:
    'bg-csnp-alert-error text-white hover:bg-red-700 focus:ring-red-300',
  success:
    'bg-csnp-alert-success text-white hover:bg-green-700 focus:ring-green-300',
  outline:
    'border-2 border-csnp-primary text-csnp-primary bg-transparent hover:bg-csnp-primary hover:text-white focus:ring-csnp-primary-light',
  ghost:
    'bg-transparent text-csnp-primary hover:bg-gray-100 focus:ring-csnp-primary-light',
};

/**
 * Button size style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * Icon size mappings (width/height in pixels) per button size.
 * @type {Object.<string, number>}
 */
const ICON_SIZES = {
  sm: 14,
  md: 16,
  lg: 20,
};

/**
 * Spinner size mappings (width/height in pixels) per button size.
 * @type {Object.<string, number>}
 */
const SPINNER_SIZES = {
  sm: 14,
  md: 16,
  lg: 20,
};

/**
 * Reusable button component with variants, sizes, loading state,
 * disabled state, and icon support.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'danger'|'success'|'outline'|'ghost'} [props.variant='primary'] - Button visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Button size
 * @param {boolean} [props.loading=false] - Whether the button is in a loading state
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {boolean} [props.fullWidth=false] - Whether the button should take full width
 * @param {React.ReactNode} [props.iconLeft] - Icon element to render before the label
 * @param {React.ReactNode} [props.iconRight] - Icon element to render after the label
 * @param {'button'|'submit'|'reset'} [props.type='button'] - HTML button type attribute
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.loadingText] - Text to display while loading (defaults to children)
 * @param {Function} [props.onClick] - Click handler
 * @param {React.ReactNode} props.children - Button label content
 * @returns {React.ReactElement}
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  type = 'button',
  className = '',
  loadingText,
  onClick,
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const spinnerSize = SPINNER_SIZES[size] || SPINNER_SIZES.md;

  const baseClass =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const widthClass = fullWidth ? 'w-full' : '';

  const combinedClassName = [
    baseClass,
    variantClass,
    sizeClass,
    widthClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={combinedClassName}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin flex-shrink-0"
          width={spinnerSize}
          height={spinnerSize}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {!loading && iconLeft && (
        <span className="flex-shrink-0" aria-hidden="true">
          {iconLeft}
        </span>
      )}

      {(children || loadingText) && (
        <span
          className={
            (loading || iconLeft || iconRight) ? 'mx-2' : ''
          }
        >
          {loading && loadingText ? loadingText : children}
        </span>
      )}

      {!loading && iconRight && (
        <span className="flex-shrink-0" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'outline', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
  loadingText: PropTypes.string,
  onClick: PropTypes.func,
  children: PropTypes.node,
};

Button.defaultProps = {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  fullWidth: false,
  iconLeft: null,
  iconRight: null,
  type: 'button',
  className: '',
  loadingText: undefined,
  onClick: undefined,
  children: null,
};