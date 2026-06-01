import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button.jsx';

/**
 * Empty state size style mappings using Tailwind CSS classes.
 * @type {Object.<string, { container: string, icon: string, title: string, description: string }>}
 */
const SIZE_STYLES = {
  sm: {
    container: 'py-8 px-4',
    icon: 'w-10 h-10',
    title: 'text-sm',
    description: 'text-xs',
  },
  md: {
    container: 'py-12 px-6',
    icon: 'w-14 h-14',
    title: 'text-base',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16 px-8',
    icon: 'w-20 h-20',
    title: 'text-lg',
    description: 'text-sm',
  },
};

/**
 * Empty state variant style mappings using Tailwind CSS classes.
 * @type {Object.<string, { iconColor: string, titleColor: string, descriptionColor: string, bgColor: string }>}
 */
const VARIANT_STYLES = {
  default: {
    iconColor: 'text-gray-300',
    titleColor: 'text-gray-500',
    descriptionColor: 'text-gray-400',
    bgColor: '',
  },
  primary: {
    iconColor: 'text-csnp-blue-200',
    titleColor: 'text-csnp-primary',
    descriptionColor: 'text-csnp-blue-400',
    bgColor: 'bg-csnp-blue-50',
  },
  muted: {
    iconColor: 'text-gray-200',
    titleColor: 'text-gray-400',
    descriptionColor: 'text-gray-300',
    bgColor: 'bg-gray-50',
  },
};

/**
 * Returns the default SVG icon element for the empty state.
 * @param {string} iconClassName - CSS classes for the icon
 * @returns {React.ReactElement}
 */
function getDefaultIcon(iconClassName) {
  return (
    <svg
      className={iconClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

/**
 * Returns the "no data" SVG icon element for the empty state.
 * @param {string} iconClassName - CSS classes for the icon
 * @returns {React.ReactElement}
 */
function getNoDataIcon(iconClassName) {
  return (
    <svg
      className={iconClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

/**
 * Returns the "no results" SVG icon element for the empty state.
 * @param {string} iconClassName - CSS classes for the icon
 * @returns {React.ReactElement}
 */
function getNoResultsIcon(iconClassName) {
  return (
    <svg
      className={iconClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

/**
 * Returns the "error" SVG icon element for the empty state.
 * @param {string} iconClassName - CSS classes for the icon
 * @returns {React.ReactElement}
 */
function getErrorIcon(iconClassName) {
  return (
    <svg
      className={iconClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * Returns the built-in icon element based on the icon type.
 * @param {string} iconType - The icon type ('search', 'no-data', 'no-results', 'error')
 * @param {string} iconClassName - CSS classes for the icon
 * @returns {React.ReactElement}
 */
function getBuiltInIcon(iconType, iconClassName) {
  switch (iconType) {
    case 'no-data':
      return getNoDataIcon(iconClassName);
    case 'no-results':
      return getNoResultsIcon(iconClassName);
    case 'error':
      return getErrorIcon(iconClassName);
    case 'search':
    default:
      return getDefaultIcon(iconClassName);
  }
}

/**
 * Empty state placeholder component with icon, title, description,
 * and optional action button. Used when data tables or lists have
 * no results, no data, or encounter an error state.
 *
 * @param {Object} props
 * @param {string} [props.title='No data found'] - Title text displayed prominently
 * @param {string} [props.description] - Description text displayed below the title
 * @param {React.ReactNode} [props.icon] - Custom icon element (overrides iconType)
 * @param {'search'|'no-data'|'no-results'|'error'} [props.iconType='search'] - Built-in icon type
 * @param {boolean} [props.showIcon=true] - Whether to show the icon
 * @param {string} [props.actionLabel] - Label for the optional action button
 * @param {Function} [props.onAction] - Click handler for the action button
 * @param {'primary'|'secondary'|'outline'|'ghost'} [props.actionVariant='primary'] - Variant for the action button
 * @param {React.ReactNode} [props.actionIcon] - Icon for the action button
 * @param {React.ReactNode} [props.actions] - Custom action elements (overrides actionLabel/onAction)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Empty state size
 * @param {'default'|'primary'|'muted'} [props.variant='default'] - Empty state visual variant
 * @param {boolean} [props.bordered=false] - Whether to show a border
 * @param {boolean} [props.rounded=true] - Whether to apply rounded corners
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Additional content rendered below the description
 * @returns {React.ReactElement}
 */
export default function EmptyState({
  title = 'No data found',
  description,
  icon = null,
  iconType = 'search',
  showIcon = true,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  actionIcon = null,
  actions = null,
  size = 'md',
  variant = 'default',
  bordered = false,
  rounded = true,
  className = '',
  children,
  ...rest
}) {
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES.md;
  const variantStyles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  const hasActionButton = typeof actionLabel === 'string' && actionLabel.trim().length > 0 && typeof onAction === 'function';
  const hasCustomActions = actions !== null && actions !== undefined;
  const hasChildren = children !== null && children !== undefined;

  const containerClassName = [
    'flex flex-col items-center justify-center text-center',
    sizeStyles.container,
    variantStyles.bgColor,
    bordered ? 'border border-gray-200' : '',
    rounded ? 'rounded-2xl' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconClassName = [
    sizeStyles.icon,
    variantStyles.iconColor,
    'mb-4',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Icon */}
      {showIcon && (
        <div className="flex-shrink-0">
          {icon || getBuiltInIcon(iconType, iconClassName)}
        </div>
      )}

      {/* Title */}
      {hasTitle && (
        <p className={`font-medium ${sizeStyles.title} ${variantStyles.titleColor} leading-tight`}>
          {title}
        </p>
      )}

      {/* Description */}
      {hasDescription && (
        <p className={`mt-1 ${sizeStyles.description} ${variantStyles.descriptionColor} max-w-sm leading-relaxed`}>
          {description}
        </p>
      )}

      {/* Children */}
      {hasChildren && (
        <div className="mt-3">
          {children}
        </div>
      )}

      {/* Action Button */}
      {hasActionButton && !hasCustomActions && (
        <div className="mt-4">
          <Button
            variant={actionVariant}
            size={size === 'lg' ? 'md' : 'sm'}
            onClick={onAction}
            iconLeft={actionIcon}
          >
            {actionLabel}
          </Button>
        </div>
      )}

      {/* Custom Actions */}
      {hasCustomActions && (
        <div className="mt-4 flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.node,
  iconType: PropTypes.oneOf(['search', 'no-data', 'no-results', 'error']),
  showIcon: PropTypes.bool,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  actionVariant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost']),
  actionIcon: PropTypes.node,
  actions: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['default', 'primary', 'muted']),
  bordered: PropTypes.bool,
  rounded: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

EmptyState.defaultProps = {
  title: 'No data found',
  description: undefined,
  icon: null,
  iconType: 'search',
  showIcon: true,
  actionLabel: undefined,
  onAction: undefined,
  actionVariant: 'primary',
  actionIcon: null,
  actions: null,
  size: 'md',
  variant: 'default',
  bordered: false,
  rounded: true,
  className: '',
  children: null,
};