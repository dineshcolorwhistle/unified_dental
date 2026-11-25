import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown, Edit2, Plus, X } from 'lucide-react';
import { LinkedPlanAppointment } from '../../services/clinicOdontogramService';

export interface EditAppointmentDropdownProps {
  appointments: LinkedPlanAppointment[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectAppointment: (appointmentId: string) => void;
  unscheduledCount?: number;
  canScheduleRemaining?: boolean;
  onScheduleRemaining?: () => void;
}

const STATUS_DOT_COLOR: Record<string, string> = {
  SCHEDULED: '#0284c7',
  IN_PROGRESS: '#d97706',
  COMPLETED: '#4f46e5',
  CANCELLED: '#dc2626',
};

export const EditAppointmentDropdown: React.FC<EditAppointmentDropdownProps> = ({
  appointments,
  isOpen,
  onToggle,
  onClose,
  onSelectAppointment,
  unscheduledCount = 0,
  canScheduleRemaining = false,
  onScheduleRemaining,
}) => {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith('es');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [isPositioned, setIsPositioned] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxListHeight: number;
  }>({
    left: 0,
    width: 360,
    maxListHeight: 300,
  });

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!wrapperRef.current || isMobileViewport) return;
    const rect = wrapperRef.current.getBoundingClientRect();

    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      onClose();
      return;
    }

    const width = Math.min(360, Math.max(240, window.innerWidth - 24));
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 12);
    const spaceAbove = Math.max(0, rect.top - 12);
    const shouldDropUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableSpace = shouldDropUp ? spaceAbove : spaceBelow;
    const maxListHeight = Math.max(120, Math.min(300, availableSpace - 96));

    setCoords({
      top: shouldDropUp ? undefined : rect.bottom + 6,
      bottom: shouldDropUp ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width,
      maxListHeight,
    });
    setIsPositioned(true);
  }, [isMobileViewport, onClose]);

  useLayoutEffect(() => {
    if (isOpen && !isMobileViewport) {
      calculatePosition();
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, isMobileViewport, calculatePosition]);

  useEffect(() => {
    if (!isOpen || isMobileViewport) return;

    const handleScroll = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
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
  }, [isOpen, isMobileViewport, calculatePosition]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  const handlePrimaryClick = () => {
    if (appointments.length === 1 && unscheduledCount === 0) {
      onSelectAppointment(appointments[0].id);
      return;
    }
    onToggle();
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handlePrimaryClick}
        className="btn btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#4338ca',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.45)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          cursor: 'pointer',
          minHeight: '40px',
        }}
        aria-expanded={isOpen}
        aria-label={t('patientTreatmentPlan.editAppointment', 'Edit Appointment')}
      >
        <Edit2 size={14} />
        <span>
          {appointments.length > 1
            ? t('patientTreatmentPlan.editAppointmentsCount', 'Edit Appointment ({{count}})', {
                count: appointments.length,
              })
            : t('patientTreatmentPlan.editAppointment', 'Edit Appointment')}
        </span>
        {(appointments.length > 1 || unscheduledCount > 0) && (
          <ChevronDown
            size={14}
            style={{
              transition: 'transform 0.15s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        )}
      </button>

      {isOpen &&
        (() => {
          const popoverContent = (
            <>
              {isMobileViewport && (
                <div
                  onClick={onClose}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.45)',
                    zIndex: 99999,
                  }}
                />
              )}
              <div
                ref={dropdownRef}
                style={
                  isMobileViewport
                    ? {
                        position: 'fixed',
                        left: '12px',
                        right: '12px',
                        bottom: '16px',
                        zIndex: 100000,
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '14px',
                        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
                        overflow: 'hidden',
                      }
                    : {
                        position: 'fixed',
                        top: coords.top !== undefined ? `${coords.top}px` : 'auto',
                        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        zIndex: 100000,
                        visibility: isPositioned ? 'visible' : 'hidden',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '12px',
                        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.16)',
                        overflow: 'hidden',
                      }
                }
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {t('patientTreatmentPlan.selectDoctorAppointmentPrompt', "Select a doctor's appointment to edit")}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    aria-label={t('common.close', 'Close')}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: isMobileViewport ? '60vh' : `${coords.maxListHeight}px`,
                    overflowY: 'auto',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {appointments.map((apt) => {
                    const docColor = apt.doctor?.colorCode || '#0d9488';
                    const statusColor = STATUS_DOT_COLOR[apt.status] || '#64748b';
                    const statusLabel =
                      apt.status === 'IN_PROGRESS'
                        ? isSpanish
                          ? 'En Progreso'
                          : 'In Progress'
                        : apt.status === 'COMPLETED'
                        ? isSpanish
                          ? 'Completada'
                          : 'Completed'
                        : isSpanish
                        ? 'Programada'
                        : 'Scheduled';

                    return (
                      <div
                        key={apt.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: docColor,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: 'var(--text-heading)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Dr. {apt.doctor?.name || 'Doctor'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{apt.appointmentNumber}</span>
                            <span>·</span>
                            <span>
                              {apt.date?.substring(0, 10)} {apt.startTime}
                            </span>
                            <span style={{ color: statusColor, fontWeight: 700 }}>· {statusLabel}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectAppointment(apt.id);
                          }}
                          style={{
                            minHeight: '38px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            color: '#4338ca',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <Edit2 size={12} />
                          <span>{t('patientTreatmentPlan.editAppointment', 'Edit Appointment')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {unscheduledCount > 0 && onScheduleRemaining && (
                  <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    <button
                      type="button"
                      disabled={!canScheduleRemaining}
                      onClick={() => {
                        onClose();
                        onScheduleRemaining();
                      }}
                      style={{
                        width: '100%',
                        minHeight: '40px',
                        borderRadius: '8px',
                        border: '1px solid var(--primary-500, #0d9488)',
                        backgroundColor: canScheduleRemaining ? 'rgba(13, 148, 136, 0.08)' : 'var(--bg-surface-muted)',
                        color: canScheduleRemaining ? 'var(--primary-700, #0f766e)' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: canScheduleRemaining ? 'pointer' : 'not-allowed',
                        opacity: canScheduleRemaining ? 1 : 0.6,
                      }}
                    >
                      <Calendar size={14} />
                      <Plus size={12} />
                      <span>
                        {t('patientTreatmentPlan.scheduleRemainingServices', 'Schedule Remaining Services ({{count}})', {
                          count: unscheduledCount,
                        })}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          );

          return typeof document !== 'undefined'
            ? createPortal(popoverContent, document.body)
            : popoverContent;
        })()}
    </div>
  );
};
