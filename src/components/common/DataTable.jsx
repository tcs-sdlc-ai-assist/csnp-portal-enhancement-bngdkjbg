import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Button from './Button.jsx';
import { useSearch } from '../../hooks/useSearch.js';
import { usePagination } from '../../hooks/usePagination.js';
import { PAGINATION } from '../../utils/constants.js';

/**
 * @typedef {Object} Column
 * @property {string} key - Unique column key (maps to data field, supports dot notation)
 * @property {string} label - Column header label
 * @property {boolean} [sortable=false] - Whether the column is sortable
 * @property {boolean} [searchable=false] - Whether the column is included in search
 * @property {Function} [render] - Custom cell renderer: (value, row, rowIndex) => ReactNode
 * @property {string} [className=''] - Additional CSS classes for the column cells
 * @property {string} [headerClassName=''] - Additional CSS classes for the column header
 * @property {string} [width] - Column width (e.g. 'w-32', 'min-w-[200px]')
 * @property {string} [align='left'] - Text alignment ('left', 'center', 'right')
 */

/**
 * @typedef {Object} Action
 * @property {string} label - Action button label
 * @property {Function} onClick - Click handler: (row, rowIndex) => void
 * @property {string} [variant='ghost'] - Button variant
 * @property {string} [size='sm'] - Button size
 * @property {Function} [visible] - Visibility predicate: (row) => boolean
 * @property {Function} [disabled] - Disabled predicate: (row) => boolean
 * @property {React.ReactNode} [icon] - Icon element
 */

/**
 * Retrieves a nested value from an object using dot notation.
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path
 * @returns {*} The value at the path, or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || typeof path !== 'string') {
    return undefined;
  }
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[key];
  }, obj);
}

/**
 * Alignment class mapping.
 * @type {Object.<string, string>}
 */
const ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Loading skeleton row component.
 * @param {Object} props
 * @param {number} props.columnCount - Number of columns
 * @param {boolean} props.selectable - Whether selection column is shown
 * @param {boolean} props.hasActions - Whether actions column is shown
 * @returns {React.ReactElement}
 */
function SkeletonRow({ columnCount, selectable, hasActions }) {
  const totalCols = columnCount + (selectable ? 1 : 0) + (hasActions ? 1 : 0);
  return (
    <tr className="animate-pulse">
      {selectable && (
        <td className="px-4 py-3">
          <div className="h-4 w-4 bg-gray-200 rounded" />
        </td>
      )}
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
      {hasActions && (
        <td className="px-4 py-3">
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </td>
      )}
    </tr>
  );
}

SkeletonRow.propTypes = {
  columnCount: PropTypes.number.isRequired,
  selectable: PropTypes.bool.isRequired,
  hasActions: PropTypes.bool.isRequired,
};

/**
 * Empty state component for the data table.
 * @param {Object} props
 * @param {string} props.message - Empty state message
 * @param {string} [props.description] - Optional description
 * @param {React.ReactNode} [props.icon] - Optional icon
 * @returns {React.ReactElement}
 */
function EmptyState({ message, description, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon || (
        <svg
          className="w-12 h-12 text-gray-300 mb-4"
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
      )}
      <p className="text-sm font-medium text-gray-500">{message}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
  description: PropTypes.string,
  icon: PropTypes.node,
};

EmptyState.defaultProps = {
  description: undefined,
  icon: undefined,
};

/**
 * Reusable data table component with sortable columns, pagination,
 * search/filter bar, row selection, action buttons, empty state,
 * and loading skeleton. Supports custom cell renderers.
 *
 * @param {Object} props
 * @param {Object[]} props.data - Array of data objects to display
 * @param {Column[]} props.columns - Column definitions
 * @param {Action[]} [props.actions=[]] - Row action definitions
 * @param {boolean} [props.loading=false] - Whether the table is in a loading state
 * @param {boolean} [props.selectable=false] - Whether rows are selectable
 * @param {string[]} [props.selectedIds=[]] - Array of selected row IDs
 * @param {Function} [props.onSelectionChange] - Selection change handler: (selectedIds) => void
 * @param {string} [props.idKey='id'] - Key to use as unique row identifier
 * @param {boolean} [props.searchable=true] - Whether to show the search bar
 * @param {string} [props.searchPlaceholder='Search...'] - Search input placeholder
 * @param {boolean} [props.paginated=true] - Whether to show pagination
 * @param {number} [props.initialPageSize=20] - Initial number of rows per page
 * @param {number[]} [props.pageSizeOptions] - Available page size options
 * @param {string} [props.initialSortField=''] - Initial sort field
 * @param {'asc'|'desc'} [props.initialSortDirection='asc'] - Initial sort direction
 * @param {string} [props.emptyMessage='No data found'] - Empty state message
 * @param {string} [props.emptyDescription] - Empty state description
 * @param {React.ReactNode} [props.emptyIcon] - Empty state icon
 * @param {string} [props.className=''] - Additional CSS classes for the table container
 * @param {string} [props.title] - Optional table title
 * @param {React.ReactNode} [props.headerActions] - Optional header action buttons
 * @param {Function} [props.onRowClick] - Row click handler: (row, rowIndex) => void
 * @param {Function} [props.rowClassName] - Row class name function: (row, rowIndex) => string
 * @param {number} [props.skeletonRows=5] - Number of skeleton rows to show when loading
 * @returns {React.ReactElement}
 */
export default function DataTable({
  data,
  columns,
  actions = [],
  loading = false,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  idKey = 'id',
  searchable = true,
  searchPlaceholder = 'Search...',
  paginated = true,
  initialPageSize = PAGINATION.DEFAULT_PAGE_SIZE,
  pageSizeOptions = PAGINATION.PAGE_SIZE_OPTIONS,
  initialSortField = '',
  initialSortDirection = 'asc',
  emptyMessage = 'No data found',
  emptyDescription,
  emptyIcon,
  className = '',
  title,
  headerActions,
  onRowClick,
  rowClassName,
  skeletonRows = 5,
  ...rest
}) {
  const safeData = useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);

  const safeColumns = useMemo(() => {
    return Array.isArray(columns) ? columns : [];
  }, [columns]);

  const safeActions = useMemo(() => {
    return Array.isArray(actions) ? actions : [];
  }, [actions]);

  const searchFields = useMemo(() => {
    return safeColumns
      .filter((col) => col.searchable === true)
      .map((col) => col.key);
  }, [safeColumns]);

  const {
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    setSortField,
    results: filteredData,
    totalResults,
    hasActiveSearch,
  } = useSearch(safeData, {
    searchFields,
    initialSortField,
    initialSortDirection,
    debounceMs: 300,
  });

  const {
    data: paginatedData,
    page,
    pageSize,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    isFirstPage,
    isLastPage,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize,
    reset: resetPagination,
  } = usePagination(filteredData, {
    initialPage: 1,
    initialPageSize,
  });

  const displayData = paginated ? paginatedData : filteredData;

  /**
   * Handles column header click for sorting.
   * @param {string} columnKey - The column key to sort by
   */
  const handleSort = useCallback(
    (columnKey) => {
      setSortField(columnKey);
      resetPagination();
    },
    [setSortField, resetPagination]
  );

  /**
   * Handles search input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleSearchChange = useCallback(
    (e) => {
      setSearchQuery(e.target.value);
      resetPagination();
    },
    [setSearchQuery, resetPagination]
  );

  /**
   * Handles clearing the search input.
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    resetPagination();
  }, [setSearchQuery, resetPagination]);

  /**
   * Handles selecting/deselecting all visible rows.
   */
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) {
      return;
    }

    const visibleIds = displayData
      .map((row) => row[idKey])
      .filter((id) => id !== undefined && id !== null);

    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      const newSelection = selectedIds.filter((id) => !visibleIds.includes(id));
      onSelectionChange(newSelection);
    } else {
      const newSelection = [...new Set([...selectedIds, ...visibleIds])];
      onSelectionChange(newSelection);
    }
  }, [displayData, idKey, selectedIds, onSelectionChange]);

  /**
   * Handles selecting/deselecting a single row.
   * @param {string} rowId - The row ID
   */
  const handleSelectRow = useCallback(
    (rowId) => {
      if (!onSelectionChange) {
        return;
      }

      const isSelected = selectedIds.includes(rowId);
      if (isSelected) {
        onSelectionChange(selectedIds.filter((id) => id !== rowId));
      } else {
        onSelectionChange([...selectedIds, rowId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  /**
   * Handles page size change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handlePageSizeChange = useCallback(
    (e) => {
      const newSize = parseInt(e.target.value, 10);
      if (!isNaN(newSize) && newSize > 0) {
        setPageSize(newSize);
      }
    },
    [setPageSize]
  );

  /**
   * Determines if all visible rows are selected.
   * @type {boolean}
   */
  const allVisibleSelected = useMemo(() => {
    if (displayData.length === 0) {
      return false;
    }
    const visibleIds = displayData
      .map((row) => row[idKey])
      .filter((id) => id !== undefined && id !== null);
    return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  }, [displayData, idKey, selectedIds]);

  /**
   * Determines if some (but not all) visible rows are selected.
   * @type {boolean}
   */
  const someVisibleSelected = useMemo(() => {
    if (displayData.length === 0) {
      return false;
    }
    const visibleIds = displayData
      .map((row) => row[idKey])
      .filter((id) => id !== undefined && id !== null);
    const selectedCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < visibleIds.length;
  }, [displayData, idKey, selectedIds]);

  const hasActions = safeActions.length > 0;

  /**
   * Renders the sort indicator for a column header.
   * @param {string} columnKey - The column key
   * @returns {React.ReactElement|null}
   */
  function renderSortIndicator(columnKey) {
    if (sortField !== columnKey) {
      return (
        <svg
          className="w-3 h-3 ml-1 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 15l5 5 5-5" />
          <path d="M7 9l5-5 5 5" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg
        className="w-3 h-3 ml-1 text-csnp-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 9l5-5 5 5" />
      </svg>
    ) : (
      <svg
        className="w-3 h-3 ml-1 text-csnp-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 15l5 5 5-5" />
      </svg>
    );
  }

  /**
   * Renders a cell value, using a custom renderer if provided.
   * @param {Column} column - The column definition
   * @param {Object} row - The row data
   * @param {number} rowIndex - The row index
   * @returns {React.ReactNode}
   */
  function renderCell(column, row, rowIndex) {
    const value = getNestedValue(row, column.key);

    if (typeof column.render === 'function') {
      return column.render(value, row, rowIndex);
    }

    if (value === null || value === undefined) {
      return <span className="text-gray-400">—</span>;
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  }

  return (
    <div className={`bg-white rounded-2xl shadow-card ${className}`} {...rest}>
      {/* Header */}
      {(title || headerActions || searchable || (selectable && selectedIds.length > 0)) && (
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          {/* Title Row */}
          {(title || headerActions) && (
            <div className="flex items-center justify-between mb-3">
              {title && (
                <h3 className="text-lg font-semibold text-csnp-primary">{title}</h3>
              )}
              {!title && <div />}
              {headerActions && (
                <div className="flex items-center gap-2">{headerActions}</div>
              )}
            </div>
          )}

          {/* Search and Selection Info Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Search Bar */}
            {searchable && (
              <div className="relative flex-1 max-w-sm w-full">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 focus:bg-white focus:border-csnp-primary-light focus:ring-2 focus:ring-csnp-primary-light focus:outline-none transition-all duration-200"
                  aria-label="Search table"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label="Clear search"
                  >
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
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Selection Info */}
            <div className="flex items-center gap-3">
              {selectable && selectedIds.length > 0 && (
                <span className="text-xs text-csnp-primary font-medium bg-csnp-blue-50 px-2 py-1 rounded-full">
                  {selectedIds.length} selected
                </span>
              )}
              {hasActiveSearch && (
                <span className="text-xs text-gray-500">
                  {totalResults} result{totalResults !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {/* Selection Checkbox Header */}
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = someVisibleSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer"
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {/* Column Headers */}
              {safeColumns.map((column) => {
                const alignClass = ALIGN_CLASSES[column.align] || ALIGN_CLASSES.left;
                const isSorted = sortField === column.key;

                return (
                  <th
                    key={column.key}
                    className={`px-4 py-3 font-medium text-xs text-gray-500 uppercase tracking-wider ${alignClass} ${column.width || ''} ${column.headerClassName || ''} ${
                      column.sortable ? 'cursor-pointer select-none hover:text-csnp-primary transition-colors duration-150' : ''
                    } ${isSorted ? 'text-csnp-primary' : ''}`}
                    onClick={column.sortable ? () => handleSort(column.key) : undefined}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <div className={`flex items-center ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      <span>{column.label}</span>
                      {column.sortable && renderSortIndicator(column.key)}
                    </div>
                  </th>
                );
              })}

              {/* Actions Header */}
              {hasActions && (
                <th className="px-4 py-3 font-medium text-xs text-gray-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-100">
            {/* Loading State */}
            {loading && (
              <>
                {Array.from({ length: skeletonRows }).map((_, i) => (
                  <SkeletonRow
                    key={`skeleton-${i}`}
                    columnCount={safeColumns.length}
                    selectable={selectable}
                    hasActions={hasActions}
                  />
                ))}
              </>
            )}

            {/* Data Rows */}
            {!loading && displayData.length > 0 && displayData.map((row, rowIndex) => {
              const rowId = row[idKey];
              const isSelected = selectable && selectedIds.includes(rowId);
              const isClickable = typeof onRowClick === 'function';
              const customRowClass = typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : '';

              return (
                <tr
                  key={rowId !== undefined && rowId !== null ? rowId : rowIndex}
                  className={`transition-colors duration-150 ${
                    isSelected
                      ? 'bg-csnp-blue-50'
                      : 'hover:bg-gray-50'
                  } ${isClickable ? 'cursor-pointer' : ''} ${customRowClass}`}
                  onClick={
                    isClickable
                      ? (e) => {
                          if (
                            e.target.closest('button') ||
                            e.target.closest('input[type="checkbox"]') ||
                            e.target.closest('a')
                          ) {
                            return;
                          }
                          onRowClick(row, rowIndex);
                        }
                      : undefined
                  }
                >
                  {/* Selection Checkbox */}
                  {selectable && (
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowId)}
                        className="w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer"
                        aria-label={`Select row ${rowId}`}
                      />
                    </td>
                  )}

                  {/* Data Cells */}
                  {safeColumns.map((column) => {
                    const alignClass = ALIGN_CLASSES[column.align] || ALIGN_CLASSES.left;

                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-gray-700 ${alignClass} ${column.width || ''} ${column.className || ''}`}
                      >
                        {renderCell(column, row, rowIndex)}
                      </td>
                    );
                  })}

                  {/* Action Buttons */}
                  {hasActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {safeActions.map((action, actionIndex) => {
                          const isVisible = typeof action.visible === 'function'
                            ? action.visible(row)
                            : true;

                          if (!isVisible) {
                            return null;
                          }

                          const isDisabled = typeof action.disabled === 'function'
                            ? action.disabled(row)
                            : false;

                          return (
                            <Button
                              key={actionIndex}
                              variant={action.variant || 'ghost'}
                              size={action.size || 'sm'}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row, rowIndex);
                              }}
                              disabled={isDisabled}
                              iconLeft={action.icon}
                            >
                              {action.label}
                            </Button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty State */}
        {!loading && displayData.length === 0 && (
          <EmptyState
            message={hasActiveSearch ? 'No results match your search' : emptyMessage}
            description={hasActiveSearch ? 'Try adjusting your search terms' : emptyDescription}
            icon={emptyIcon}
          />
        )}
      </div>

      {/* Pagination */}
      {paginated && !loading && totalResults > 0 && (
        <div className="px-4 md:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Page Size Selector and Info */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <label htmlFor="datatable-page-size" className="whitespace-nowrap">
                Rows per page:
              </label>
              <select
                id="datatable-page-size"
                value={pageSize}
                onChange={handlePageSizeChange}
                className="border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden sm:inline">
              Showing {startIndex + 1}–{Math.min(endIndex, totalResults)} of {totalResults}
            </span>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={firstPage}
              disabled={isFirstPage}
              className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              aria-label="First page"
              title="First page"
            >
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
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={previousPage}
              disabled={!hasPreviousPage}
              className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              aria-label="Previous page"
              title="Previous page"
            >
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
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Page Numbers */}
            {(() => {
              const pages = [];
              const maxVisiblePages = 5;
              let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToPage(i)}
                    className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors duration-150 ${
                      i === page
                        ? 'bg-csnp-primary text-white'
                        : 'text-gray-600 hover:text-csnp-primary hover:bg-gray-100'
                    }`}
                    aria-label={`Page ${i}`}
                    aria-current={i === page ? 'page' : undefined}
                  >
                    {i}
                  </button>
                );
              }

              return pages;
            })()}

            <button
              type="button"
              onClick={nextPage}
              disabled={!hasNextPage}
              className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              aria-label="Next page"
              title="Next page"
            >
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
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={lastPage}
              disabled={isLastPage}
              className="p-1.5 rounded text-gray-400 hover:text-csnp-primary hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              aria-label="Last page"
              title="Last page"
            >
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
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

DataTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      searchable: PropTypes.bool,
      render: PropTypes.func,
      className: PropTypes.string,
      headerClassName: PropTypes.string,
      width: PropTypes.string,
      align: PropTypes.oneOf(['left', 'center', 'right']),
    })
  ).isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      variant: PropTypes.string,
      size: PropTypes.string,
      visible: PropTypes.func,
      disabled: PropTypes.func,
      icon: PropTypes.node,
    })
  ),
  loading: PropTypes.bool,
  selectable: PropTypes.bool,
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func,
  idKey: PropTypes.string,
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  paginated: PropTypes.bool,
  initialPageSize: PropTypes.number,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  initialSortField: PropTypes.string,
  initialSortDirection: PropTypes.oneOf(['asc', 'desc']),
  emptyMessage: PropTypes.string,
  emptyDescription: PropTypes.string,
  emptyIcon: PropTypes.node,
  className: PropTypes.string,
  title: PropTypes.string,
  headerActions: PropTypes.node,
  onRowClick: PropTypes.func,
  rowClassName: PropTypes.func,
  skeletonRows: PropTypes.number,
};

DataTable.defaultProps = {
  actions: [],
  loading: false,
  selectable: false,
  selectedIds: [],
  onSelectionChange: undefined,
  idKey: 'id',
  searchable: true,
  searchPlaceholder: 'Search...',
  paginated: true,
  initialPageSize: PAGINATION.DEFAULT_PAGE_SIZE,
  pageSizeOptions: PAGINATION.PAGE_SIZE_OPTIONS,
  initialSortField: '',
  initialSortDirection: 'asc',
  emptyMessage: 'No data found',
  emptyDescription: undefined,
  emptyIcon: undefined,
  className: '',
  title: undefined,
  headerActions: undefined,
  onRowClick: undefined,
  rowClassName: undefined,
  skeletonRows: 5,
};