import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Button from './Button.jsx';

/**
 * Modal size style mappings using Tailwind CSS classes.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-4xl',
};

/**
 * Reusable modal dialog component with overlay, title, body, footer actions,
 * close button, and size variants. Supports confirmation dialogs and form modals.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Handler called when the modal should close
 * @param {string} [props.title=''] - Modal title text
 * @param {React.ReactNode} [props.children] - Modal body content
 * @param {'sm'|'md'|'lg'|'xl'|'2xl'|'full'} [props.size='md'] - Modal size variant
 * @param {boolean} [props.showCloseButton=true] - Whether to show the close (X) button
 * @param {boolean} [props.closeOnOverlayClick=true] - Whether clicking the overlay closes the modal
 * @param {boolean} [props.closeOnEscape=true] - Whether pressing Escape closes the modal
 * @param {React.ReactNode} [props.footer] - Custom footer content (overrides action buttons)
 * @param {string} [props.confirmText] - Text for the confirm/primary action button
 * @param {string} [props.cancelText] - Text for the cancel/secondary action button
 * @param {Function} [props.onConfirm] - Handler called when the confirm button is clicked
 * @param {Function} [props.onCancel] - Handler called when the cancel button is clicked (defaults to onClose)
 * @param {'primary'|'secondary'|'danger'|'success'} [props.confirmVariant='primary'] - Variant for the confirm button
 * @param {boolean} [props.confirmLoading=false] - Whether the confirm button is in a loading state
 * @param {boolean} [props.confirmDisabled=false] - Whether the confirm button is disabled
 * @param {string} [props.className=''] - Additional CSS classes for the modal content container
 * @param {string} [props.overlayClassName=''] - Additional CSS classes for the overlay
 * @param {string} [props.bodyClassName=''] - Additional CSS classes for the modal body
 * @returns {React.ReactElement|null}
 */
export default function Modal({
  isOpen,
  onClose,
  title = '',
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  confirmLoading = false,
  confirmDisabled = false,
  className = '',
  overlayClassName = '',
  bodyClassName = '',
  ...rest
}) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  /**
   * Handles the cancel action, falling back to onClose if onCancel is not provided.
   */
  const handleCancel = useCallback(() => {
    if (typeof onCancel === 'function') {
      onCancel();
    } else {
      onClose();
    }
  }, [onCancel, onClose]);

  /**
   * Handles overlay click to close the modal.
   * @param {React.MouseEvent} e - Mouse event
   */
  const handleOverlayClick = useCallback(
    (e) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  /**
   * Handles keydown events for Escape key and focus trapping.
   */
  useEffect(() => {
    if (!isOpen || !closeOnEscape) {
      return;
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  /**
   * Manages body scroll lock and focus management when modal opens/closes.
   */
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // Focus the modal container after a short delay to allow rendering
      const timer = setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';

        // Restore focus to the previously focused element
        if (
          previousActiveElementRef.current &&
          typeof previousActiveElementRef.current.focus === 'function'
        ) {
          previousActiveElementRef.current.focus();
        }
      };
    }

    return undefined;
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;

  const hasActionButtons =
    (typeof confirmText === 'string' && confirmText.length > 0) ||
    (typeof cancelText === 'string' && cancelText.length > 0);

  const showFooter = footer !== undefined || hasActionButtons;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-200"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`relative z-50 w-full ${sizeClass} bg-white rounded-2xl shadow-card-hover flex flex-col max-h-[90vh] transition-all duration-200 focus:outline-none ${className}`}
        {...rest}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            {title && (
              <h2
                id="modal-title"
                className="text-lg font-semibold text-csnp-primary truncate pr-4"
              >
                {title}
              </h2>
            )}
            {!title && <div />}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light transition-colors duration-200"
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
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
        )}

        {/* Body */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-4 ${bodyClassName}`}
        >
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            {footer !== undefined ? (
              footer
            ) : (
              <>
                {(typeof cancelText === 'string' && cancelText.length > 0) && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleCancel}
                    disabled={confirmLoading}
                  >
                    {cancelText}
                  </Button>
                )}
                {(typeof confirmText === 'string' && confirmText.length > 0) && (
                  <Button
                    variant={confirmVariant}
                    size="md"
                    onClick={onConfirm}
                    loading={confirmLoading}
                    disabled={confirmDisabled}
                  >
                    {confirmText}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl', 'full']),
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  footer: PropTypes.node,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  confirmVariant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success']),
  confirmLoading: PropTypes.bool,
  confirmDisabled: PropTypes.bool,
  className: PropTypes.string,
  overlayClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
};

Modal.defaultProps = {
  title: '',
  children: null,
  size: 'md',
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEscape: true,
  footer: undefined,
  confirmText: undefined,
  cancelText: undefined,
  onConfirm: undefined,
  onCancel: undefined,
  confirmVariant: 'primary',
  confirmLoading: false,
  confirmDisabled: false,
  className: '',
  overlayClassName: '',
  bodyClassName: '',
};