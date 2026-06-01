/**
 * Custom React hook for client-side pagination.
 * Manages page state, items per page, total pages calculation,
 * paginated data slicing, and navigation functions.
 * @module usePagination
 */

import { useState, useMemo, useCallback } from 'react';
import { PAGINATION } from '../utils/constants.js';

/**
 * @typedef {Object} UsePaginationReturn
 * @property {Array} data - The paginated slice of items for the current page
 * @property {number} page - Current page number (1-indexed)
 * @property {number} pageSize - Number of items per page
 * @property {number} totalItems - Total number of items
 * @property {number} totalPages - Total number of pages
 * @property {boolean} hasNextPage - Whether there is a next page
 * @property {boolean} hasPreviousPage - Whether there is a previous page
 * @property {boolean} isFirstPage - Whether the current page is the first page
 * @property {boolean} isLastPage - Whether the current page is the last page
 * @property {number} startIndex - Zero-based start index of the current page slice
 * @property {number} endIndex - Zero-based end index (exclusive) of the current page slice
 * @property {function(number): void} goToPage - Navigate to a specific page number
 * @property {function(): void} nextPage - Navigate to the next page
 * @property {function(): void} previousPage - Navigate to the previous page
 * @property {function(): void} firstPage - Navigate to the first page
 * @property {function(): void} lastPage - Navigate to the last page
 * @property {function(number): void} setPageSize - Change the number of items per page (resets to page 1)
 * @property {function(): void} reset - Reset pagination to page 1 with current page size
 */

/**
 * Custom React hook for client-side pagination.
 * Provides paginated data slicing, page navigation, and page size management.
 *
 * @param {Array} items - The full array of items to paginate
 * @param {Object} [options={}] - Pagination options
 * @param {number} [options.initialPage=1] - Initial page number (1-indexed)
 * @param {number} [options.initialPageSize=20] - Initial number of items per page
 * @returns {UsePaginationReturn} The pagination state and control functions
 *
 * @example
 * const {
 *   data,
 *   page,
 *   totalPages,
 *   hasNextPage,
 *   hasPreviousPage,
 *   nextPage,
 *   previousPage,
 *   goToPage,
 *   setPageSize,
 * } = usePagination(members, { initialPage: 1, initialPageSize: 10 });
 */
export function usePagination(items, options = {}) {
  const {
    initialPage = PAGINATION.DEFAULT_PAGE,
    initialPageSize = PAGINATION.DEFAULT_PAGE_SIZE,
  } = options;

  const [page, setPage] = useState(() => {
    const p = typeof initialPage === 'number' && initialPage >= 1 ? Math.floor(initialPage) : PAGINATION.DEFAULT_PAGE;
    return p;
  });

  const [pageSize, setPageSizeState] = useState(() => {
    const ps = typeof initialPageSize === 'number' && initialPageSize >= 1 ? Math.floor(initialPageSize) : PAGINATION.DEFAULT_PAGE_SIZE;
    return ps;
  });

  const safeItems = useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  const totalItems = safeItems.length;

  const totalPages = useMemo(() => {
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / pageSize);
  }, [totalItems, pageSize]);

  const safePage = useMemo(() => {
    if (page < 1) {
      return 1;
    }
    if (page > totalPages) {
      return totalPages;
    }
    return page;
  }, [page, totalPages]);

  const startIndex = useMemo(() => {
    return (safePage - 1) * pageSize;
  }, [safePage, pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + pageSize, totalItems);
  }, [startIndex, pageSize, totalItems]);

  const data = useMemo(() => {
    return safeItems.slice(startIndex, endIndex);
  }, [safeItems, startIndex, endIndex]);

  const hasNextPage = safePage < totalPages;
  const hasPreviousPage = safePage > 1;
  const isFirstPage = safePage === 1;
  const isLastPage = safePage >= totalPages;

  /**
   * Navigates to a specific page number.
   * Clamps the page number to valid bounds.
   * @param {number} pageNumber - The page number to navigate to (1-indexed)
   */
  const goToPage = useCallback((pageNumber) => {
    if (typeof pageNumber !== 'number' || isNaN(pageNumber)) {
      return;
    }

    const targetPage = Math.floor(pageNumber);
    setPage((prev) => {
      const clamped = Math.max(1, Math.min(targetPage, totalPages));
      return clamped;
    });
  }, [totalPages]);

  /**
   * Navigates to the next page if available.
   */
  const nextPage = useCallback(() => {
    setPage((prev) => {
      if (prev >= totalPages) {
        return prev;
      }
      return prev + 1;
    });
  }, [totalPages]);

  /**
   * Navigates to the previous page if available.
   */
  const previousPage = useCallback(() => {
    setPage((prev) => {
      if (prev <= 1) {
        return prev;
      }
      return prev - 1;
    });
  }, []);

  /**
   * Navigates to the first page.
   */
  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  /**
   * Navigates to the last page.
   */
  const lastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  /**
   * Changes the number of items per page and resets to page 1.
   * @param {number} newPageSize - The new page size
   */
  const setPageSize = useCallback((newPageSize) => {
    if (typeof newPageSize !== 'number' || isNaN(newPageSize) || newPageSize < 1) {
      return;
    }

    const size = Math.floor(newPageSize);
    setPageSizeState(size);
    setPage(1);
  }, []);

  /**
   * Resets pagination to page 1 with the current page size.
   */
  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    data,
    page: safePage,
    pageSize,
    totalItems,
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
    reset,
  };
}

export default usePagination;