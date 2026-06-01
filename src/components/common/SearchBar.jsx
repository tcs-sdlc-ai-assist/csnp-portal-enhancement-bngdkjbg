import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Size style mappings for the search bar input.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'pl-8 pr-8 py-1.5 text-xs',
  md: 'pl-9 pr-9 py-2 text-sm',
  lg: 'pl-10 pr-10 py-2.5 text-base',
};

/**
 * Icon size mappings per search bar size.
 * @type {Object.<string, number>}
 */
const ICON_SIZES = {
  sm: 14,
  md: 16,
  lg: 18,
};

/**
 * Icon left position mappings per search bar size.
 * @type {Object.<string, string>}
 */
const ICON_LEFT_POSITIONS = {
  sm: 'left-2.5',
  md: 'left-3',
  lg: 'left-3.5',
};

/**
 * Clear button right position mappings per search bar size.
 * @type {Object.<string, string>}
 */
const CLEAR_RIGHT_POSITIONS = {
  sm: 'right-2',
  md: 'right-2.5',
  lg: 'right-3',
};

/**
 * Default debounce delay in milliseconds.
 * @type {number}
 */
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Reusable search bar component with debounced input, clear button,
 * search icon, and placeholder text. Emits search value on change.
 *
 * @param {Object} props
 * @param {string} [props.value] - Controlled search value
 * @param {string} [props.defaultValue=''] - Default search value (uncontrolled mode)
 * @param {Function} [props.onChange] - Callback when search value changes (receives the string value)
 * @param {Function} [props.onSubmit] - Callback when search is submitted (Enter key pressed)
 * @param {Function} [props.onClear] - Callback when search is cleared
 * @param {string} [props.placeholder='Search...'] - Placeholder text
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Search bar size
 * @param {number} [props.debounceMs=300] - Debounce delay in milliseconds (0 = no debounce)
 * @param {boolean} [props.showClearButton=true] - Whether to show the clear button when input has value
 * @param {boolean} [props.disabled=false] - Whether the search bar is disabled
 * @param {boolean} [props.autoFocus=false] - Whether to auto-focus the input
 * @param {boolean} [props.fullWidth=true] - Whether the search bar takes full width
 * @param {string} [props.className=''] - Additional CSS classes for the wrapper
 * @param {string} [props.inputClassName=''] - Additional CSS classes for the input element
 * @param {string} [props.ariaLabel='Search'] - Aria label for the input
 * @param {React.ReactNode} [props.iconLeft] - Custom icon element (overrides default search icon)
 * @returns {React.ReactElement}
 */
export default function SearchBar({
  value,
  defaultValue = '',
  onChange,
  onSubmit,
  onClear,
  placeholder = 'Search...',
  size = 'md',
  debounceMs = DEFAULT_DEBOUNCE_MS,
  showClearButton = true,
  disabled = false,
  autoFocus = false,
  fullWidth = true,
  className = '',
  inputClassName = '',
  ariaLabel = 'Search',
  iconLeft = null,
  ...rest
}) {
  const isControlled = value !== undefined && value !== null;

  const [internalValue, setInternalValue] = useState(() => {
    if (isControlled) {
      return value;
    }
    return typeof defaultValue === 'string' ? defaultValue : '';
  });

  const debounceTimerRef = useRef(null);
  const inputRef = useRef(null);

  /**
   * Syncs internal value with controlled value when it changes.
   */
  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
    }
  }, [isControlled, value]);

  /**
   * Cleans up debounce timer on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Emits the onChange callback, optionally debounced.
   * @param {string} newValue - The new search value
   */
  const emitChange = useCallback(
    (newValue) => {
      if (typeof onChange !== 'function') {
        return;
      }

      if (typeof debounceMs === 'number' && debounceMs > 0) {
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          onChange(newValue);
          debounceTimerRef.current = null;
        }, debounceMs);
      } else {
        onChange(newValue);
      }
    },
    [onChange, debounceMs]
  );

  /**
   * Handles input change events.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleChange = useCallback(
    (e) => {
      const newValue = e.target.value;

      if (!isControlled) {
        setInternalValue(newValue);
      }

      emitChange(newValue);
    },
    [isControlled, emitChange]
  );

  /**
   * Handles clearing the search input.
   */
  const handleClear = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!isControlled) {
      setInternalValue('');
    }

    if (typeof onChange === 'function') {
      onChange('');
    }

    if (typeof onClear === 'function') {
      onClear();
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isControlled, onChange, onClear]);

  /**
   * Handles keydown events for Enter key submission.
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keyboard event
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        // Flush any pending debounced change
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;

          if (typeof onChange === 'function') {
            onChange(currentValue);
          }
        }

        if (typeof onSubmit === 'function') {
          onSubmit(isControlled ? value : internalValue);
        }
      }
    },
    [onSubmit, onChange, isControlled, value, internalValue]
  );

  const currentValue = isControlled ? value : internalValue;
  const hasValue = typeof currentValue === 'string' && currentValue.length > 0;

  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;
  const iconLeftPos = ICON_LEFT_POSITIONS[size] || ICON_LEFT_POSITIONS.md;
  const clearRightPos = CLEAR_RIGHT_POSITIONS[size] || CLEAR_RIGHT_POSITIONS.md;
  const widthClass = fullWidth ? 'w-full' : '';

  const wrapperClassName = [
    'relative',
    widthClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inputCombinedClassName = [
    'w-full bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400',
    'focus:bg-white focus:border-csnp-primary-light focus:ring-2 focus:ring-csnp-primary-light focus:outline-none',
    'transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100',
    sizeClass,
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName} {...rest}>
      {/* Search Icon */}
      <div
        className={`absolute ${iconLeftPos} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}
        aria-hidden="true"
      >
        {iconLeft || (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={inputCombinedClassName}
        aria-label={ariaLabel}
      />

      {/* Clear Button */}
      {showClearButton && hasValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={`absolute ${clearRightPos} top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-200`}
          aria-label="Clear search"
        >
          <svg
            width={iconSize}
            height={iconSize}
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

SearchBar.propTypes = {
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  debounceMs: PropTypes.number,
  showClearButton: PropTypes.bool,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  ariaLabel: PropTypes.string,
  iconLeft: PropTypes.node,
};

SearchBar.defaultProps = {
  value: undefined,
  defaultValue: '',
  onChange: undefined,
  onSubmit: undefined,
  onClear: undefined,
  placeholder: 'Search...',
  size: 'md',
  debounceMs: 300,
  showClearButton: true,
  disabled: false,
  autoFocus: false,
  fullWidth: true,
  className: '',
  inputClassName: '',
  ariaLabel: 'Search',
  iconLeft: null,
};