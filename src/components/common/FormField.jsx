import React from 'react';
import PropTypes from 'prop-types';

/**
 * Input type to HTML element mapping.
 * @type {Object.<string, string>}
 */
const INPUT_TYPES = {
  text: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
  tel: 'tel',
  url: 'url',
  date: 'date',
  time: 'time',
  search: 'search',
};

/**
 * Size style mappings for form field inputs.
 * @type {Object.<string, string>}
 */
const SIZE_STYLES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

/**
 * Size style mappings for labels.
 * @type {Object.<string, string>}
 */
const LABEL_SIZE_STYLES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

/**
 * Reusable form field component supporting text, select, date, textarea,
 * checkbox, and radio inputs with label, validation error display,
 * required indicator, and helper text.
 *
 * @param {Object} props
 * @param {string} props.name - Input name attribute (also used as id if id is not provided)
 * @param {string} [props.id] - Input id attribute (defaults to name)
 * @param {string} [props.label] - Label text
 * @param {'text'|'email'|'password'|'number'|'tel'|'url'|'date'|'time'|'search'|'select'|'textarea'|'checkbox'|'radio'} [props.type='text'] - Input type
 * @param {string|number|boolean} [props.value] - Input value
 * @param {Function} [props.onChange] - Change handler
 * @param {Function} [props.onBlur] - Blur handler
 * @param {Function} [props.onFocus] - Focus handler
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {boolean} [props.disabled=false] - Whether the field is disabled
 * @param {boolean} [props.readOnly=false] - Whether the field is read-only
 * @param {string} [props.error] - Validation error message
 * @param {string} [props.helperText] - Helper text displayed below the input
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Input size
 * @param {boolean} [props.fullWidth=true] - Whether the input takes full width
 * @param {string} [props.className=''] - Additional CSS classes for the wrapper
 * @param {string} [props.inputClassName=''] - Additional CSS classes for the input element
 * @param {string} [props.labelClassName=''] - Additional CSS classes for the label
 * @param {Object[]} [props.options] - Options for select and radio inputs
 * @param {string|number} props.options[].value - Option value
 * @param {string} props.options[].label - Option label
 * @param {boolean} [props.options[].disabled] - Whether the option is disabled
 * @param {number} [props.rows=3] - Number of rows for textarea
 * @param {number} [props.minRows] - Minimum rows for textarea
 * @param {number} [props.maxRows] - Maximum rows for textarea
 * @param {string} [props.min] - Minimum value for number/date inputs
 * @param {string} [props.max] - Maximum value for number/date inputs
 * @param {string} [props.step] - Step value for number inputs
 * @param {number} [props.maxLength] - Maximum character length
 * @param {string} [props.pattern] - Input pattern attribute
 * @param {string} [props.autoComplete] - Autocomplete attribute
 * @param {boolean} [props.autoFocus=false] - Whether to auto-focus the input
 * @param {React.ReactNode} [props.iconLeft] - Icon element rendered inside the input on the left
 * @param {React.ReactNode} [props.iconRight] - Icon element rendered inside the input on the right
 * @param {boolean} [props.checked] - Checked state for checkbox/radio
 * @returns {React.ReactElement}
 */
export default function FormField({
  name,
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  error,
  helperText,
  size = 'md',
  fullWidth = true,
  className = '',
  inputClassName = '',
  labelClassName = '',
  options = [],
  rows = 3,
  minRows,
  maxRows,
  min,
  max,
  step,
  maxLength,
  pattern,
  autoComplete,
  autoFocus = false,
  iconLeft = null,
  iconRight = null,
  checked,
  ...rest
}) {
  const inputId = id || name;
  const hasError = typeof error === 'string' && error.trim().length > 0;
  const hasHelperText = typeof helperText === 'string' && helperText.trim().length > 0;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const labelSizeClass = LABEL_SIZE_STYLES[size] || LABEL_SIZE_STYLES.md;
  const widthClass = fullWidth ? 'w-full' : '';

  const baseInputClass =
    'border rounded-lg transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50';

  const normalBorderClass = hasError
    ? 'border-csnp-alert-error focus:ring-red-300 focus:border-csnp-alert-error'
    : 'border-gray-300 focus:ring-csnp-primary-light focus:border-csnp-primary-light';

  const textInputClass = [
    baseInputClass,
    normalBorderClass,
    sizeClass,
    widthClass,
    'text-gray-900 placeholder-gray-400 bg-white',
    iconLeft ? 'pl-9' : '',
    iconRight ? 'pr-9' : '',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClass = [
    'flex flex-col',
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * Renders the label element.
   * @returns {React.ReactElement|null}
   */
  function renderLabel() {
    if (!label) {
      return null;
    }

    if (type === 'checkbox' || type === 'radio') {
      return null;
    }

    return (
      <label
        htmlFor={inputId}
        className={`font-medium text-gray-700 mb-1 ${labelSizeClass} ${labelClassName}`}
      >
        {label}
        {required && (
          <span className="text-csnp-alert-error ml-0.5\" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  }

  /**
   * Renders the error message.
   * @returns {React.ReactElement|null}
   */
  function renderError() {
    if (!hasError) {
      return null;
    }

    return (
      <p className="mt-1 text-xs text-csnp-alert-error\" role="alert">
        {error}
      </p>
    );
  }

  /**
   * Renders the helper text.
   * @returns {React.ReactElement|null}
   */
  function renderHelperText() {
    if (!hasHelperText || hasError) {
      return null;
    }

    return (
      <p className="mt-1 text-xs text-gray-500">
        {helperText}
      </p>
    );
  }

  /**
   * Renders a checkbox input.
   * @returns {React.ReactElement}
   */
  function renderCheckbox() {
    return (
      <div className={wrapperClass}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id={inputId}
              name={name}
              checked={checked || false}
              onChange={onChange}
              onBlur={onBlur}
              onFocus={onFocus}
              disabled={disabled}
              required={required}
              className={`w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${hasError ? 'border-csnp-alert-error' : ''} ${inputClassName}`}
              aria-invalid={hasError ? 'true' : undefined}
              aria-describedby={hasError ? `${inputId}-error` : hasHelperText ? `${inputId}-helper` : undefined}
              {...rest}
            />
          </div>
          {label && (
            <label
              htmlFor={inputId}
              className={`ml-2 font-medium text-gray-700 cursor-pointer ${labelSizeClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${labelClassName}`}
            >
              {label}
              {required && (
                <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}
        </div>
        {hasError && (
          <p className="mt-1 text-xs text-csnp-alert-error ml-6" role="alert" id={`${inputId}-error`}>
            {error}
          </p>
        )}
        {hasHelperText && !hasError && (
          <p className="mt-1 text-xs text-gray-500 ml-6" id={`${inputId}-helper`}>
            {helperText}
          </p>
        )}
      </div>
    );
  }

  /**
   * Renders radio button inputs.
   * @returns {React.ReactElement}
   */
  function renderRadio() {
    const safeOptions = Array.isArray(options) ? options : [];

    return (
      <div className={wrapperClass}>
        {label && (
          <span
            className={`font-medium text-gray-700 mb-2 ${labelSizeClass} ${labelClassName}`}
          >
            {label}
            {required && (
              <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </span>
        )}
        <div
          className="flex flex-col gap-2"
          role="radiogroup"
          aria-labelledby={label ? `${inputId}-group-label` : undefined}
          aria-required={required ? 'true' : undefined}
        >
          {safeOptions.map((option, index) => {
            const optionId = `${inputId}-${index}`;
            const isChecked = value !== undefined && value !== null && String(value) === String(option.value);
            const isOptionDisabled = disabled || option.disabled === true;

            return (
              <div key={optionId} className="flex items-center">
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  checked={isChecked}
                  onChange={onChange}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  disabled={isOptionDisabled}
                  required={required && index === 0}
                  className={`w-4 h-4 border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${hasError ? 'border-csnp-alert-error' : ''} ${inputClassName}`}
                  aria-invalid={hasError ? 'true' : undefined}
                  {...rest}
                />
                <label
                  htmlFor={optionId}
                  className={`ml-2 text-gray-700 cursor-pointer ${labelSizeClass} ${isOptionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
        {hasError && (
          <p className="mt-1 text-xs text-csnp-alert-error" role="alert" id={`${inputId}-error`}>
            {error}
          </p>
        )}
        {hasHelperText && !hasError && (
          <p className="mt-1 text-xs text-gray-500" id={`${inputId}-helper`}>
            {helperText}
          </p>
        )}
      </div>
    );
  }

  /**
   * Renders a select input.
   * @returns {React.ReactElement}
   */
  function renderSelect() {
    const safeOptions = Array.isArray(options) ? options : [];

    return (
      <div className={wrapperClass}>
        {renderLabel()}
        <select
          id={inputId}
          name={name}
          value={value !== undefined && value !== null ? value : ''}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          className={[
            baseInputClass,
            normalBorderClass,
            sizeClass,
            widthClass,
            'text-gray-900 bg-white appearance-none cursor-pointer',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2720%27%20height%3D%2720%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%239ca3af%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M6%209l6%206%206-6%27%2F%3E%3C%2Fsvg%3E")] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10',
            inputClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={
            hasError
              ? `${inputId}-error`
              : hasHelperText
                ? `${inputId}-helper`
                : undefined
          }
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {safeOptions.map((option) => (
            <option
              key={String(option.value)}
              value={option.value}
              disabled={option.disabled === true}
            >
              {option.label}
            </option>
          ))}
        </select>
        {renderError()}
        {renderHelperText()}
      </div>
    );
  }

  /**
   * Renders a textarea input.
   * @returns {React.ReactElement}
   */
  function renderTextarea() {
    const textareaRows = rows || 3;

    return (
      <div className={wrapperClass}>
        {renderLabel()}
        <textarea
          id={inputId}
          name={name}
          value={value !== undefined && value !== null ? value : ''}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          rows={textareaRows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={[
            baseInputClass,
            normalBorderClass,
            sizeClass,
            widthClass,
            'text-gray-900 placeholder-gray-400 bg-white resize-y',
            inputClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={
            hasError
              ? `${inputId}-error`
              : hasHelperText
                ? `${inputId}-helper`
                : undefined
          }
          {...rest}
        />
        {maxLength && (
          <div className="flex justify-end mt-0.5">
            <span className="text-[10px] text-gray-400">
              {typeof value === 'string' ? value.length : 0}/{maxLength}
            </span>
          </div>
        )}
        {renderError()}
        {renderHelperText()}
      </div>
    );
  }

  /**
   * Renders a standard text-like input.
   * @returns {React.ReactElement}
   */
  function renderTextInput() {
    const htmlType = INPUT_TYPES[type] || 'text';

    return (
      <div className={wrapperClass}>
        {renderLabel()}
        <div className="relative">
          {iconLeft && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">
              {iconLeft}
            </div>
          )}
          <input
            type={htmlType}
            id={inputId}
            name={name}
            value={value !== undefined && value !== null ? value : ''}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            min={min}
            max={max}
            step={step}
            maxLength={maxLength}
            pattern={pattern}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            className={textInputClass}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : hasHelperText
                  ? `${inputId}-helper`
                  : undefined
            }
            {...rest}
          />
          {iconRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">
              {iconRight}
            </div>
          )}
        </div>
        {renderError()}
        {renderHelperText()}
      </div>
    );
  }

  // Render based on type
  if (type === 'checkbox') {
    return renderCheckbox();
  }

  if (type === 'radio') {
    return renderRadio();
  }

  if (type === 'select') {
    return renderSelect();
  }

  if (type === 'textarea') {
    return renderTextarea();
  }

  return renderTextInput();
}

FormField.propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string,
  label: PropTypes.string,
  type: PropTypes.oneOf([
    'text',
    'email',
    'password',
    'number',
    'tel',
    'url',
    'date',
    'time',
    'search',
    'select',
    'textarea',
    'checkbox',
    'radio',
  ]),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.string,
  helperText: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ),
  rows: PropTypes.number,
  minRows: PropTypes.number,
  maxRows: PropTypes.number,
  min: PropTypes.string,
  max: PropTypes.string,
  step: PropTypes.string,
  maxLength: PropTypes.number,
  pattern: PropTypes.string,
  autoComplete: PropTypes.string,
  autoFocus: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  checked: PropTypes.bool,
};

FormField.defaultProps = {
  id: undefined,
  label: undefined,
  type: 'text',
  value: undefined,
  onChange: undefined,
  onBlur: undefined,
  onFocus: undefined,
  placeholder: undefined,
  required: false,
  disabled: false,
  readOnly: false,
  error: undefined,
  helperText: undefined,
  size: 'md',
  fullWidth: true,
  className: '',
  inputClassName: '',
  labelClassName: '',
  options: [],
  rows: 3,
  minRows: undefined,
  maxRows: undefined,
  min: undefined,
  max: undefined,
  step: undefined,
  maxLength: undefined,
  pattern: undefined,
  autoComplete: undefined,
  autoFocus: false,
  iconLeft: null,
  iconRight: null,
  checked: undefined,
};