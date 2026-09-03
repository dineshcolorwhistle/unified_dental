import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}) => {
  const { t } = useTranslation();

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        width: '100%',
        boxSizing: 'border-box',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '0 0 12px 12px',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '13px',
      }}
    >
      {/* Left: Range Info */}
      <div style={{ color: 'var(--text-muted)' }}>
        {t('common.paginationShowing', {
          from: startItem,
          to: endItem,
          total: totalItems,
          defaultValue: `Showing ${startItem} to ${endItem} of ${totalItems} entries`,
        })}
      </div>

      {/* Right: Page Size & Page Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Rows per page selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <span>{t('common.rowsPerPage', 'Rows per page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title={t('common.firstPage', 'First Page')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: currentPage <= 1 ? 'var(--text-subtle)' : 'var(--text-main)',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title={t('common.prevPage', 'Previous Page')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: currentPage <= 1 ? 'var(--text-subtle)' : 'var(--text-main)',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronLeft size={15} />
          </button>

          {/* Page Number Buttons */}
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 6px',
                    color: 'var(--text-subtle)',
                    userSelect: 'none',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '30px',
                  height: '30px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid var(--primary-600)' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--primary-600)' : 'var(--bg-surface)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title={t('common.nextPage', 'Next Page')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: currentPage >= totalPages ? 'var(--text-subtle)' : 'var(--text-main)',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronRight size={15} />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title={t('common.lastPage', 'Last Page')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: currentPage >= totalPages ? 'var(--text-subtle)' : 'var(--text-main)',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
