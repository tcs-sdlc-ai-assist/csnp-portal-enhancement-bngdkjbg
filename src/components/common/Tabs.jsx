import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Tab size style mappings using Tailwind CSS classes.
 * @type {Object.<string, { tab: string, text: string, indicator: string }>}
 */
const SIZE_STYLES = {
  sm: {
    tab: 'px-3 py-1.5',
    text: 'text-xs',
    indicator: 'h-0.5',
  },
  md: {
    tab: 'px-4 py-2.5',
    text: 'text-sm',
    indicator: 'h-0.5',
  },
  lg: {
    tab: 'px-5 py-3',
    text: 'text-base',
    indicator: 'h-1',
  },
};

/**
 * Tab variant style mappings using Tailwind CSS classes.
 * @type {Object.<string, { container: string, tab: string, activeTab: string, inactiveTab: string, indicator: string, panel: string }>}
 */
const VARIANT_STYLES = {
  underline: {
    container: 'border-b border-gray-200',
    tab: 'relative',
    activeTab: 'text-csnp-primary font-semibold',
    inactiveTab: 'text-gray-500 hover:text-csnp-primary-light',
    indicator: 'absolute bottom-0 left-0 right-0 bg-csnp-primary rounded-t-full',
    panel: 'pt-4',
  },
  pills: {
    container: 'bg-gray-100 rounded-lg p-1',
    tab: 'rounded-md',
    activeTab: 'bg-white text-csnp-primary font-semibold shadow-sm',
    inactiveTab: 'text-gray-500 hover:text-csnp-primary-light',
    indicator: '',
    panel: 'pt-4',
  },
  boxed: {
    container: 'border-b border-gray-200',
    tab: 'border border-transparent -mb-px',
    activeTab: 'bg-white text-csnp-primary font-semibold border-gray-200 border-b-white rounded-t-lg',
    inactiveTab: 'text-gray-500 hover:text-csnp-primary-light hover:bg-gray-50 rounded-t-lg',
    indicator: '',
    panel: 'pt-4',
  },
};

/**
 * @typedef {Object} TabItem
 * @property {string} key - Unique tab key
 * @property {string} label - Tab header label
 * @property {React.ReactNode} [content] - Tab panel content
 * @property {React.ReactNode} [icon] - Optional icon element rendered before the label
 * @property {boolean} [disabled=false] - Whether the tab is disabled
 * @property {string|number} [badge] - Optional badge value displayed after the label
 */

/**
 * Reusable tabbed interface component with tab headers, active tab indicator,
 * and content panels. Supports controlled and uncontrolled modes, multiple
 * visual variants, sizes, and optional icons/badges on tabs.
 *
 * @param {Object} props
 * @param {TabItem[]} props.tabs - Array of tab definitions
 * @param {string} [props.activeKey] - Active tab key (controlled mode)
 * @param {string} [props.defaultActiveKey] - Default active tab key (uncontrolled mode)
 * @param {Function} [props.onChange] - Callback when active tab changes: (key) => void
 * @param {'underline'|'pills'|'boxed'} [props.variant='underline'] - Tab visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Tab size
 * @param {boolean} [props.fullWidth=false] - Whether tabs should take full width
 * @param {boolean} [props.lazy=false] - Whether to lazily render tab panels (only render active panel)
 * @param {string} [props.className=''] - Additional CSS classes for the outer container
 * @param {string} [props.tabListClassName=''] - Additional CSS classes for the tab list
 * @param {string} [props.tabClassName=''] - Additional CSS classes for individual tabs
 * @param {string} [props.panelClassName=''] - Additional CSS classes for the tab panel
 * @param {React.ReactNode} [props.children] - Alternative to tabs[].content — render children based on active key
 * @param {React.ReactNode} [props.extra] - Extra content rendered at the right side of the tab list
 * @returns {React.ReactElement}
 */
export default function Tabs({
  tabs,
  activeKey,
  defaultActiveKey,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  lazy = false,
  className = '',
  tabListClassName = '',
  tabClassName = '',
  panelClassName = '',
  children,
  extra = null,
  ...rest
}) {
  const safeTabs = useMemo(() => {
    return Array.isArray(tabs) ? tabs : [];
  }, [tabs]);

  const isControlled = activeKey !== undefined && activeKey !== null;

  const [internalActiveKey, setInternalActiveKey] = useState(() => {
    if (isControlled) {
      return activeKey;
    }
    if (typeof defaultActiveKey === 'string' && defaultActiveKey.length > 0) {
      return defaultActiveKey;
    }
    if (safeTabs.length > 0) {
      const firstEnabled = safeTabs.find((tab) => !tab.disabled);
      return firstEnabled ? firstEnabled.key : safeTabs[0].key;
    }
    return '';
  });

  const currentActiveKey = isControlled ? activeKey : internalActiveKey;

  /**
   * Tracks which tabs have been visited for non-lazy unmount behavior.
   */
  const visitedKeysRef = useRef(new Set());

  useEffect(() => {
    if (currentActiveKey) {
      visitedKeysRef.current.add(currentActiveKey);
    }
  }, [currentActiveKey]);

  /**
   * Handles tab click.
   * @param {string} key - The tab key that was clicked
   */
  const handleTabClick = useCallback(
    (key) => {
      if (!isControlled) {
        setInternalActiveKey(key);
      }

      if (typeof onChange === 'function') {
        onChange(key);
      }
    },
    [isControlled, onChange]
  );

  /**
   * Handles keyboard navigation within the tab list.
   * @param {React.KeyboardEvent} e - Keyboard event
   * @param {number} currentIndex - Current tab index
   */
  const handleKeyDown = useCallback(
    (e, currentIndex) => {
      const enabledTabs = safeTabs.filter((tab) => !tab.disabled);
      if (enabledTabs.length === 0) {
        return;
      }

      const currentEnabledIndex = enabledTabs.findIndex(
        (tab) => tab.key === safeTabs[currentIndex].key
      );

      let nextIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentEnabledIndex + 1) % enabledTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentEnabledIndex - 1 + enabledTabs.length) % enabledTabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
      }

      if (nextIndex >= 0 && nextIndex < enabledTabs.length) {
        const nextTab = enabledTabs[nextIndex];
        handleTabClick(nextTab.key);

        const tabElement = document.getElementById(`tab-${nextTab.key}`);
        if (tabElement) {
          tabElement.focus();
        }
      }
    },
    [safeTabs, handleTabClick]
  );

  const variantStyles = VARIANT_STYLES[variant] || VARIANT_STYLES.underline;
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES.md;

  /**
   * Renders the active tab's content panel.
   * @returns {React.ReactElement|null}
   */
  function renderPanels() {
    if (children !== undefined && children !== null) {
      return (
        <div
          className={`${variantStyles.panel} ${panelClassName}`}
          role="tabpanel"
          aria-labelledby={`tab-${currentActiveKey}`}
          id={`tabpanel-${currentActiveKey}`}
        >
          {children}
        </div>
      );
    }

    if (lazy) {
      const activeTab = safeTabs.find((tab) => tab.key === currentActiveKey);
      if (!activeTab || activeTab.content === undefined || activeTab.content === null) {
        return null;
      }

      return (
        <div
          className={`${variantStyles.panel} ${panelClassName}`}
          role="tabpanel"
          aria-labelledby={`tab-${currentActiveKey}`}
          id={`tabpanel-${currentActiveKey}`}
          tabIndex={0}
        >
          {activeTab.content}
        </div>
      );
    }

    return safeTabs.map((tab) => {
      const isActive = tab.key === currentActiveKey;
      const hasBeenVisited = visitedKeysRef.current.has(tab.key);

      if (!isActive && !hasBeenVisited) {
        return null;
      }

      if (tab.content === undefined || tab.content === null) {
        return null;
      }

      return (
        <div
          key={tab.key}
          className={`${variantStyles.panel} ${panelClassName} ${isActive ? '' : 'hidden'}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.key}`}
          id={`tabpanel-${tab.key}`}
          tabIndex={0}
          hidden={!isActive}
        >
          {tab.content}
        </div>
      );
    });
  }

  /**
   * Renders a badge element for a tab.
   * @param {string|number|undefined} badge - Badge value
   * @returns {React.ReactElement|null}
   */
  function renderBadge(badge) {
    if (badge === undefined || badge === null) {
      return null;
    }

    return (
      <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-csnp-blue-100 text-csnp-primary leading-none">
        {badge}
      </span>
    );
  }

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tabListContainerClassName = [
    'flex items-center',
    variantStyles.container,
    tabListClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Tab List */}
      <div className={tabListContainerClassName}>
        <div
          className={`flex ${fullWidth ? 'flex-1' : ''}`}
          role="tablist"
          aria-orientation="horizontal"
        >
          {safeTabs.map((tab, index) => {
            const isActive = tab.key === currentActiveKey;
            const isDisabled = tab.disabled === true;

            const tabButtonClassName = [
              'inline-flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 whitespace-nowrap',
              variantStyles.tab,
              sizeStyles.tab,
              sizeStyles.text,
              isActive ? variantStyles.activeTab : variantStyles.inactiveTab,
              isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              fullWidth ? 'flex-1' : '',
              tabClassName,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                aria-disabled={isDisabled}
                tabIndex={isActive ? 0 : -1}
                disabled={isDisabled}
                className={tabButtonClassName}
                onClick={
                  isDisabled
                    ? undefined
                    : () => handleTabClick(tab.key)
                }
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                {/* Icon */}
                {tab.icon && (
                  <span className="flex-shrink-0 mr-1.5" aria-hidden="true">
                    {tab.icon}
                  </span>
                )}

                {/* Label */}
                <span>{tab.label}</span>

                {/* Badge */}
                {renderBadge(tab.badge)}

                {/* Active Indicator (underline variant) */}
                {variant === 'underline' && isActive && (
                  <span
                    className={`${variantStyles.indicator} ${sizeStyles.indicator}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Extra content */}
        {extra && (
          <div className="ml-auto flex-shrink-0 pl-4">
            {extra}
          </div>
        )}
      </div>

      {/* Tab Panels */}
      {renderPanels()}
    </div>
  );
}

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      content: PropTypes.node,
      icon: PropTypes.node,
      disabled: PropTypes.bool,
      badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  activeKey: PropTypes.string,
  defaultActiveKey: PropTypes.string,
  onChange: PropTypes.func,
  variant: PropTypes.oneOf(['underline', 'pills', 'boxed']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  fullWidth: PropTypes.bool,
  lazy: PropTypes.bool,
  className: PropTypes.string,
  tabListClassName: PropTypes.string,
  tabClassName: PropTypes.string,
  panelClassName: PropTypes.string,
  children: PropTypes.node,
  extra: PropTypes.node,
};

Tabs.defaultProps = {
  activeKey: undefined,
  defaultActiveKey: undefined,
  onChange: undefined,
  variant: 'underline',
  size: 'md',
  fullWidth: false,
  lazy: false,
  className: '',
  tabListClassName: '',
  tabClassName: '',
  panelClassName: '',
  children: undefined,
  extra: null,
};