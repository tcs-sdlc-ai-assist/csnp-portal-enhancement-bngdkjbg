import React from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal.jsx';

/**
 * Confirmation dialog variant style mappings.
 * @type {Object.<string, { confirmVariant: string, iconColor: string, iconBg: string }>}
 */
const VARIANT_STYLES = {
  danger: {
    confirmVariant: 'danger',
    iconColor: 'text-csnp-alert-error',
    iconBg: 'bg-csnp-alert-error-light',
  },
  warning: {
    confirmVariant: 'danger',
    iconColor: 'text-csnp-alert-warning',
    iconBg: 'bg-csnp-alert-warning-light',
  },
  info: {
    confirmVariant: 'primary',
    iconColor: 'text-csnp-alert-info',
    iconBg: 'bg-csnp-alert-info-light',
  },
  success: {
    confirmVariant: 'success',
    iconColor: 'text-csnp-alert-success',
    iconBg: 'bg-csnp-alert-success-light',
  },
};

/**
 * Returns the default SVG icon element for a given variant.
 * @param {string} variant - The dialog variant
 * @param {string} iconColor - The icon color class
 * @returns {React.ReactElement}
 */
function getDefaultIcon(variant, iconColor) {
  switch (variant) {
    case 'danger':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'warning':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'success':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconColor}
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
 * Confirmation dialog component for destructive or important actions.
 * Wraps the Modal component with a standardized confirmation layout
 * including an icon, title, message, and confirm/cancel buttons.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onClose - Handler called when the dialog should close
 * @param {Function} props.onConfirm - Handler called when the confirm button is clicked
 * @param {string} [props.title='Are you sure?'] - Dialog title text
 * @param {string|React.ReactNode} [props.message] - Dialog message content
 * @param {string} [props.confirmText='Confirm'] - Text for the confirm button
 * @param {string} [props.cancelText='Cancel'] - Text for the cancel button
 * @param {'danger'|'warning'|'info'|'success'} [props.variant='danger'] - Dialog visual variant
 * @param {boolean} [props.confirmLoading=false] - Whether the confirm button is in a loading state
 * @param {boolean} [props.confirmDisabled=false] - Whether the confirm button is disabled
 * @param {string} [props.confirmLoadingText] - Text to display on the confirm button while loading
 * @param {boolean} [props.showIcon=true] - Whether to show the variant icon
 * @param {React.ReactNode} [props.icon] - Custom icon element (overrides default variant icon)
 * @param {boolean} [props.closeOnOverlayClick=true] - Whether clicking the overlay closes the dialog
 * @param {boolean} [props.closeOnEscape=true] - Whether pressing Escape closes the dialog
 * @param {'sm'|'md'|'lg'} [props.size='sm'] - Dialog size variant
 * @param {string} [props.className=''] - Additional CSS classes for the dialog
 * @param {React.ReactNode} [props.children] - Additional content rendered below the message
 * @returns {React.ReactElement|null}
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  confirmLoading = false,
  confirmDisabled = false,
  confirmLoadingText,
  showIcon = true,
  icon = null,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size = 'sm',
  className = '',
  children,
  ...rest
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;

  const hasMessage = message !== null && message !== undefined;
  const hasChildren = children !== null && children !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      showCloseButton={false}
      closeOnOverlayClick={closeOnOverlayClick}
      closeOnEscape={closeOnEscape}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={onConfirm}
      onCancel={onClose}
      confirmVariant={styles.confirmVariant}
      confirmLoading={confirmLoading}
      confirmDisabled={confirmDisabled}
      className={className}
      {...rest}
    >
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        {/* Icon */}
        {showIcon && (
          <div
            className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full ${styles.iconBg} mx-auto sm:mx-0`}
          >
            {icon || getDefaultIcon(variant, styles.iconColor)}
          </div>
        )}

        {/* Content */}
        <div className={showIcon ? 'mt-3 sm:mt-0 sm:ml-4 flex-1 min-w-0' : 'flex-1 min-w-0'}>
          {title && (
            <h3 className="text-base font-semibold text-gray-900 leading-tight">
              {title}
            </h3>
          )}
          {hasMessage && (
            <div className="mt-2">
              {typeof message === 'string' ? (
                <p className="text-sm text-gray-500 leading-relaxed">
                  {message}
                </p>
              ) : (
                message
              )}
            </div>
          )}
          {hasChildren && (
            <div className="mt-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['danger', 'warning', 'info', 'success']),
  confirmLoading: PropTypes.bool,
  confirmDisabled: PropTypes.bool,
  confirmLoadingText: PropTypes.string,
  showIcon: PropTypes.bool,
  icon: PropTypes.node,
  closeOnOverlayClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  children: PropTypes.node,
};

ConfirmDialog.defaultProps = {
  title: 'Are you sure?',
  message: undefined,
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
  confirmLoading: false,
  confirmDisabled: false,
  confirmLoadingText: undefined,
  showIcon: true,
  icon: null,
  closeOnOverlayClick: true,
  closeOnEscape: true,
  size: 'sm',
  className: '',
  children: null,
};