import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SearchableSelectOption {
  value: string;
  label: string;
  selectedLabel?: string;
  sublabel?: string;
  group?: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  compact?: boolean;
  triggerStyle?: React.CSSProperties;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  compact = false,
  triggerStyle,
  icon,
  className = '',
  style,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isPositioned, setIsPositioned] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    minWidth: number;
    maxWidth: number;
    listMaxHeight: number;
    dropUp: boolean;
  }>({
    left: 0,
    minWidth: 180,
    maxWidth: 420,
    listMaxHeight: 240,
    dropUp: false,
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
        (opt.group && opt.group.toLowerCase().includes(term)),
    );
  }, [options, search]);

  const calculatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();

    // Auto-close if trigger completely scrolled outside the viewport
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      setIsOpen(false);
      setIsPositioned(false);
      setSearch('');
      return;
    }

    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 10);
    const spaceAbove = Math.max(0, rect.top - 10);
    const shouldDropUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableHeight = shouldDropUp ? spaceAbove : spaceBelow;
    const listMaxHeight = Math.max(110, Math.min(240, availableHeight - 58));

    const maxWidth = Math.min(420, Math.max(160, window.innerWidth - 16));
    const minWidth = Math.min(rect.width, maxWidth);
    if (dropdownRef.current) {
      dropdownRef.current.style.minWidth = `${minWidth}px`;
      dropdownRef.current.style.maxWidth = `${maxWidth}px`;
    }
    const measuredWidth = dropdownRef.current
      ? Math.min(Math.max(dropdownRef.current.offsetWidth, minWidth), maxWidth)
      : minWidth;

    let left = rect.left;
    if (left + measuredWidth > window.innerWidth - 8) {
      left = rect.right - measuredWidth;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - measuredWidth - 8));

    setCoords({
      top: shouldDropUp ? undefined : rect.bottom + 6,
      bottom: shouldDropUp ? window.innerHeight - rect.top + 6 : undefined,
      left,
      minWidth,
      maxWidth,
      listMaxHeight,
      dropUp: shouldDropUp,
    });
    setIsPositioned(true);
  }, []);

  // Compute portal coordinates synchronously before paint when opened or filtered list changes
  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, filteredOptions.length, calculatePosition]);

  // Keep aligned with trigger on scroll or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = (event: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      calculatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen, calculatePosition]);

  // Close dropdown on click outside (covering both trigger wrapper and portaled menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
        setIsPositioned(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens without jumping scroll
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 30);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsPositioned(false);
        setSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Group filtered options if groups exist
  const groupedOptions = useMemo(() => {
    const hasGroups = filteredOptions.some((opt) => opt.group);
    if (!hasGroups) return null;

    const groups: Record<string, SearchableSelectOption[]> = {};
    for (const opt of filteredOptions) {
      const groupName = opt.group || 'General';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(opt);
    }
    return groups;
  }, [filteredOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setIsPositioned(false);
    setSearch('');
  };

  const dropdownMenu = isOpen ? (
    <div
      ref={dropdownRef}
      className={`searchable-select-dropdown searchable-select-portal ${coords.dropUp ? 'drop-up' : ''}`}
      style={{
        position: 'fixed',
        top: coords.top !== undefined ? `${coords.top}px` : 'auto',
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
        left: `${coords.left}px`,
        right: 'auto',
        minWidth: `${coords.minWidth}px`,
        maxWidth: `${coords.maxWidth}px`,
        zIndex: 100000,
        visibility: isPositioned ? 'visible' : 'hidden',
      }}
    >
      {/* Search Input Bar */}
      <div className="searchable-select-search-box">
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={searchInputRef}
          type="text"
          className="searchable-select-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder || t('common.search')}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Options List */}
      <div
        className="searchable-select-list"
        style={{ maxHeight: `${coords.listMaxHeight}px` }}
      >
        {filteredOptions.length === 0 ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            {t('common.search')} — {t('common.noOptionsFound', 'No results')}
          </div>
        ) : groupedOptions ? (
          Object.entries(groupedOptions).map(([groupName, items]) => (
            <div key={groupName}>
              <div className="searchable-select-group-header">{groupName}</div>
              {items.map((opt) => {
                const isSelected = opt.value === value;
                const isDisabled = !!opt.disabled;
                return (
                  <div
                    key={opt.value}
                    className={`searchable-select-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handleSelect(opt.value)}
                    style={{
                      opacity: isDisabled ? 0.45 : 1,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      {opt.icon}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isSelected
                              ? (opt.badgeBg || 'rgba(13, 148, 136, 0.2)')
                              : (opt.badgeBg || 'var(--bg-surface-muted)'),
                            color: opt.badgeColor || (isSelected ? 'var(--primary-600)' : 'var(--text-subtle)'),
                            border: opt.badgeColor ? `1px solid ${opt.badgeColor}33` : undefined,
                            fontWeight: 700,
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = opt.value === value;
            const isDisabled = !!opt.disabled;
            return (
              <div
                key={opt.value}
                className={`searchable-select-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleSelect(opt.value)}
                style={{
                  opacity: isDisabled ? 0.45 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  {opt.icon}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isSelected
                          ? (opt.badgeBg || 'rgba(13, 148, 136, 0.2)')
                          : (opt.badgeBg || 'var(--bg-surface-muted)'),
                        color: opt.badgeColor || (isSelected ? 'var(--primary-600)' : 'var(--text-subtle)'),
                        border: opt.badgeColor ? `1px solid ${opt.badgeColor}33` : undefined,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`searchable-select-wrapper ${isOpen ? 'is-open' : ''} ${className}`}
      style={{
        ...style,
        zIndex: isOpen ? 1000 : undefined,
      }}
      ref={wrapperRef}
    >
      {/* Select Trigger */}
      <button
        type="button"
        className={`searchable-select-trigger ${isOpen ? 'open' : ''} ${compact ? 'compact' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          ...(compact
            ? {
                padding: '4px 8px',
                minHeight: '32px',
                height: '32px',
                fontSize: '12px',
                borderRadius: '6px',
              }
            : {}),
          ...triggerStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {icon && <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>{icon}</span>}
          {selectedOption ? (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}
              title={selectedOption.selectedLabel || selectedOption.label}
            >
              {selectedOption.icon && (
                <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                  {selectedOption.icon}
                </span>
              )}
              <span
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  display: 'block',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {selectedOption.selectedLabel || selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    backgroundColor: selectedOption.badgeBg || 'rgba(13, 148, 136, 0.1)',
                    color: selectedOption.badgeColor || 'var(--primary-600)',
                    border: selectedOption.badgeColor ? `1px solid ${selectedOption.badgeColor}33` : undefined,
                    flexShrink: 0,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span
              style={{
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                minWidth: 0,
                flex: 1,
              }}
            >
              {placeholder || t('common.search')}
            </span>
          )}
        </div>
        <ChevronDown
          size={compact ? 13 : 16}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.18s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Portaled Searchable Dropdown (renders in document.body to eliminate overflow/z-index clipping) */}
      {dropdownMenu &&
        (typeof document !== 'undefined' ? createPortal(dropdownMenu, document.body) : dropdownMenu)}
    </div>
  );
};
