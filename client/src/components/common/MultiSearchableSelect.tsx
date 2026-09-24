import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  profession?: string;
}

export interface MultiSearchableSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  className = '',
  style,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Flip upward if close to bottom
  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < 260 && spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  // Close on outside click
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

  // Focus search input
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Escape key handler
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

  const selectedOptions = useMemo(() => {
    return options.filter((opt) => values.includes(opt.value));
  }, [options, values]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
        (opt.profession && opt.profession.toLowerCase().includes(term)),
    );
  }, [options, search]);

  const toggleOption = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const removeValue = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((v) => v !== val));
  };

  return (
    <div
      className={`searchable-select-wrapper ${isOpen ? 'is-open' : ''} ${className}`}
      style={{
        ...style,
        position: 'relative',
        zIndex: isOpen ? 1000 : undefined,
      }}
      ref={wrapperRef}
    >
      {/* Trigger */}
      <button
        type="button"
        className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: '40px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-input, var(--bg-card))',
          color: 'var(--text-main)',
          fontSize: '13px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', flex: 1, minWidth: 0, paddingRight: '8px' }}>
          {selectedOptions.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>
              {placeholder || t('reminders.selectUsersPlaceholder', 'Select users to assign')}
            </span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
                  color: 'var(--primary-700, #0f766e)',
                  border: '1px solid var(--primary-200, #99f6e4)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => removeValue(opt.value, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeValue(opt.value, e as any);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0.7,
                    borderRadius: '50%',
                  }}
                >
                  <X size={13} />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            [dropUp ? 'bottom' : 'top']: 'calc(100% + 4px)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 1050,
            overflow: 'hidden',
            maxHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-surface, var(--bg-card))',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder || t('common.search', 'Search...')}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '13px',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', maxHeight: '230px', padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {t('common.noOptionsFound', 'No options found')}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => toggleOption(opt.value, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      backgroundColor: isSelected ? 'var(--bg-surface-hover, rgba(15, 118, 110, 0.08))' : 'transparent',
                      transition: 'background-color 0.12s ease',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {/* Checkbox indicator */}
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: isSelected ? 'none' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--primary-600, #0d9488)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: isSelected ? 600 : 500, color: 'var(--text-main)' }}>
                          {opt.label}
                        </span>
                      </div>
                    </div>

                    {opt.profession && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor:
                            opt.profession === 'Doctor'
                              ? 'var(--badge-primary-bg, #f0fdfa)'
                              : opt.profession === 'Tenant Admin'
                              ? 'var(--badge-warning-bg, #fef3c7)'
                              : opt.profession === 'Lab Admin'
                              ? 'var(--badge-success-bg, #dcfce7)'
                              : 'var(--badge-gray-bg, #f1f5f9)',
                          color:
                            opt.profession === 'Doctor'
                              ? 'var(--primary-700, #0f766e)'
                              : opt.profession === 'Tenant Admin'
                              ? 'var(--amber-700, #b45309)'
                              : opt.profession === 'Lab Admin'
                              ? 'var(--emerald-700, #15803d)'
                              : 'var(--text-muted, #64748b)',
                          flexShrink: 0,
                        }}
                      >
                        {opt.profession}
                      </span>
                    )}
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
