/**
 * Custom React hook for search and filtering.
 * Provides debounced search input, multi-field filtering,
 * sort direction, and filtered results computation.
 * @module useSearch
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { filterBySearch, sortByField } from '../utils/helpers.js';

/**
 * @typedef {Object} UseSearchReturn
 * @property {string} searchQuery - The current raw search query (updates immediately on input)
 * @property {string} debouncedQuery - The debounced search query (updates after delay)
 * @property {function(string): void} setSearchQuery - Sets the search query
 * @property {Object.<string, *>} filters - Current active filters map
 * @property {function(string, *): void} setFilter - Sets a single filter by key
 * @property {function(Object.<string, *>): void} setFilters - Sets multiple filters at once
 * @property {function(string): void} removeFilter - Removes a single filter by key
 * @property {function(): void} clearFilters - Clears all filters
 * @property {string} sortField - Current sort field
 * @property {'asc'|'desc'} sortDirection - Current sort direction
 * @property {function(string): void} setSortField - Sets the sort field (toggles direction if same field)
 * @property {function('asc'|'desc'): void} setSortDirection - Sets the sort direction directly
 * @property {function(): void} toggleSortDirection - Toggles between asc and desc
 * @property {Array} results - The filtered, sorted results
 * @property {number} totalResults - Total number of results after filtering
 * @property {boolean} hasActiveSearch - Whether a search query is active
 * @property {boolean} hasActiveFilters - Whether any filters are active
 * @property {function(): void} reset - Resets search, filters, and sort to initial state
 */

/**
 * Default debounce delay in milliseconds.
 * @type {number}
 */
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Custom React hook for search and filtering.
 * Provides debounced search input, multi-field filtering,
 * sort direction, and filtered results computation.
 *
 * @param {Array} items - The full array of items to search and filter
 * @param {Object} [options={}] - Search options
 * @param {string[]} [options.searchFields=[]] - Fields to search across for text matching
 * @param {string} [options.initialSortField=''] - Initial sort field
 * @param {'asc'|'desc'} [options.initialSortDirection='asc'] - Initial sort direction
 * @param {number} [options.debounceMs=300] - Debounce delay in milliseconds
 * @param {function(Object[], Object.<string, *>): Object[]} [options.filterFn] - Custom filter function
 * @returns {UseSearchReturn} The search state and control functions
 *
 * @example
 * const {
 *   searchQuery,
 *   setSearchQuery,
 *   filters,
 *   setFilter,
 *   clearFilters,
 *   sortField,
 *   setSortField,
 *   results,
 *   totalResults,
 *   reset,
 * } = useSearch(members, {
 *   searchFields: ['firstName', 'lastName', 'medicareId'],
 *   initialSortField: 'lastName',
 *   initialSortDirection: 'asc',
 * });
 */
export function useSearch(items, options = {}) {
  const {
    searchFields = [],
    initialSortField = '',
    initialSortDirection = 'asc',
    debounceMs = DEFAULT_DEBOUNCE_MS,
    filterFn = null,
  } = options;

  const [searchQuery, setSearchQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFiltersState] = useState({});
  const [sortField, setSortFieldState] = useState(() => {
    return typeof initialSortField === 'string' ? initialSortField : '';
  });
  const [sortDirection, setSortDirectionState] = useState(() => {
    return initialSortDirection === 'desc' ? 'desc' : 'asc';
  });

  const debounceTimerRef = useRef(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Sets the search query with debounced update.
   * @param {string} query - The search query
   */
  const setSearchQuery = useCallback((query) => {
    const value = typeof query === 'string' ? query : '';
    setSearchQueryState(value);

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      debounceTimerRef.current = null;
    }, debounceMs);
  }, [debounceMs]);

  /**
   * Sets a single filter by key.
   * If value is null, undefined, or empty string, the filter is removed.
   * @param {string} key - The filter key
   * @param {*} value - The filter value
   */
  const setFilter = useCallback((key, value) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return;
    }

    const trimmedKey = key.trim();

    setFiltersState((prev) => {
      if (value === null || value === undefined || value === '') {
        const updated = { ...prev };
        delete updated[trimmedKey];
        return updated;
      }
      return { ...prev, [trimmedKey]: value };
    });
  }, []);

  /**
   * Sets multiple filters at once, merging with existing filters.
   * @param {Object.<string, *>} newFilters - Map of filter keys to values
   */
  const setFilters = useCallback((newFilters) => {
    if (!newFilters || typeof newFilters !== 'object' || Array.isArray(newFilters)) {
      return;
    }

    setFiltersState((prev) => {
      const updated = { ...prev };

      for (const [key, value] of Object.entries(newFilters)) {
        if (typeof key !== 'string' || key.trim().length === 0) {
          continue;
        }

        const trimmedKey = key.trim();

        if (value === null || value === undefined || value === '') {
          delete updated[trimmedKey];
        } else {
          updated[trimmedKey] = value;
        }
      }

      return updated;
    });
  }, []);

  /**
   * Removes a single filter by key.
   * @param {string} key - The filter key to remove
   */
  const removeFilter = useCallback((key) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return;
    }

    const trimmedKey = key.trim();

    setFiltersState((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, trimmedKey)) {
        return prev;
      }
      const updated = { ...prev };
      delete updated[trimmedKey];
      return updated;
    });
  }, []);

  /**
   * Clears all filters.
   */
  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  /**
   * Sets the sort field. If the same field is selected, toggles the sort direction.
   * @param {string} field - The field to sort by
   */
  const setSortField = useCallback((field) => {
    if (typeof field !== 'string') {
      return;
    }

    const trimmedField = field.trim();

    setSortFieldState((prevField) => {
      if (prevField === trimmedField) {
        setSortDirectionState((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirectionState('asc');
      return trimmedField;
    });
  }, []);

  /**
   * Sets the sort direction directly.
   * @param {'asc'|'desc'} direction - The sort direction
   */
  const setSortDirection = useCallback((direction) => {
    if (direction === 'asc' || direction === 'desc') {
      setSortDirectionState(direction);
    }
  }, []);

  /**
   * Toggles between ascending and descending sort direction.
   */
  const toggleSortDirection = useCallback(() => {
    setSortDirectionState((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  /**
   * Resets search, filters, and sort to initial state.
   */
  const reset = useCallback(() => {
    setSearchQueryState('');
    setDebouncedQuery('');
    setFiltersState({});
    setSortFieldState(typeof initialSortField === 'string' ? initialSortField : '');
    setSortDirectionState(initialSortDirection === 'desc' ? 'desc' : 'asc');

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [initialSortField, initialSortDirection]);

  const safeItems = useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  const safeSearchFields = useMemo(() => {
    return Array.isArray(searchFields) ? searchFields : [];
  }, [searchFields]);

  /**
   * Computed filtered and sorted results.
   */
  const results = useMemo(() => {
    let filtered = safeItems;

    // Apply text search
    if (debouncedQuery.trim().length > 0 && safeSearchFields.length > 0) {
      filtered = filterBySearch(filtered, safeSearchFields, debouncedQuery);
    }

    // Apply custom filter function
    if (typeof filterFn === 'function') {
      try {
        filtered = filterFn(filtered, filters);
      } catch (err) {
        console.error('useSearch: custom filterFn threw an error:', err);
      }
    } else {
      // Apply default key-value filters
      const activeFilterKeys = Object.keys(filters);
      if (activeFilterKeys.length > 0) {
        filtered = filtered.filter((item) => {
          if (!item || typeof item !== 'object') {
            return false;
          }

          return activeFilterKeys.every((key) => {
            const filterValue = filters[key];
            const itemValue = getNestedValueSafe(item, key);

            if (filterValue === null || filterValue === undefined || filterValue === '') {
              return true;
            }

            if (Array.isArray(filterValue)) {
              if (filterValue.length === 0) {
                return true;
              }
              if (Array.isArray(itemValue)) {
                return filterValue.some((fv) => itemValue.includes(fv));
              }
              return filterValue.includes(itemValue);
            }

            if (typeof filterValue === 'boolean') {
              return itemValue === filterValue;
            }

            if (typeof filterValue === 'string' && typeof itemValue === 'string') {
              return itemValue.toLowerCase().includes(filterValue.toLowerCase());
            }

            return itemValue === filterValue;
          });
        });
      }
    }

    // Apply sorting
    if (sortField.length > 0) {
      filtered = sortByField(filtered, sortField, sortDirection);
    }

    return filtered;
  }, [safeItems, debouncedQuery, safeSearchFields, filters, filterFn, sortField, sortDirection]);

  const totalResults = results.length;
  const hasActiveSearch = debouncedQuery.trim().length > 0;
  const hasActiveFilters = Object.keys(filters).length > 0;

  return {
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    filters,
    setFilter,
    setFilters,
    removeFilter,
    clearFilters,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    toggleSortDirection,
    results,
    totalResults,
    hasActiveSearch,
    hasActiveFilters,
    reset,
  };
}

/**
 * Safely retrieves a nested value from an object using dot notation.
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g. 'address.city')
 * @returns {*} The value at the path, or undefined if not found
 */
function getNestedValueSafe(obj, path) {
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

export default useSearch;