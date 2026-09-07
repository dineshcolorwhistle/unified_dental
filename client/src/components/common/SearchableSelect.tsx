import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
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
  icon,
  className = '',
  style,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect available space and automatically flip dropdown upward if clipped
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelowWindow = window.innerHeight - rect.bottom;
      const spaceAboveWindow = rect.top;

      const scrollParent =
        wrapperRef.current.closest('.modal-body') ||
        wrapperRef.current.closest('[style*="overflow"]');
      let spaceBelow = spaceBelowWindow;
      let spaceAbove = spaceAboveWindow;

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        spaceBelow = Math.min(spaceBelowWindow, parentRect.bottom - rect.bottom);
        spaceAbove = Math.min(spaceAboveWindow, rect.top - parentRect.top);
      }

      setDropUp(spaceBelow < 230 && spaceAbove > spaceBelow);
      setAlignRight(window.innerWidth - rect.left < 260 && rect.right > 260);
    }
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
    setSearch('');
  };

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
        className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {icon && <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>}
          {selectedOption ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    color: 'var(--primary-600)',
                    flexShrink: 0,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              {placeholder || t('common.search')}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.18s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Searchable Dropdown */}
      {isOpen && (
        <div className={`searchable-select-dropdown ${dropUp ? 'drop-up' : ''} ${alignRight ? 'align-right' : ''}`}>
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
          <div className="searchable-select-list">
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {t('common.search')} — No results
              </div>
            ) : groupedOptions ? (
              Object.entries(groupedOptions).map(([groupName, items]) => (
                <div key={groupName}>
                  <div className="searchable-select-group-header">{groupName}</div>
                  {items.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <div
                        key={opt.value}
                        className={`searchable-select-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelect(opt.value)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          {opt.icon}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: isSelected
                                  ? 'rgba(13, 148, 136, 0.2)'
                                  : 'var(--bg-surface-muted)',
                                color: isSelected ? 'var(--primary-600)' : 'var(--text-subtle)',
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
                return (
                  <div
                    key={opt.value}
                    className={`searchable-select-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {opt.icon}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isSelected
                              ? 'rgba(13, 148, 136, 0.2)'
                              : 'var(--bg-surface-muted)',
                            color: isSelected ? 'var(--primary-600)' : 'var(--text-subtle)',
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
