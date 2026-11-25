import React, { useEffect, useRef, useState } from 'react';
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
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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

      {isOpen && (
        <>
          {isMobileViewport && (
            <div
              onClick={onClose}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                zIndex: 1040,
              }}
            />
          )}
          <div
            style={
              isMobileViewport
                ? {
                    position: 'fixed',
                    left: '12px',
                    right: '12px',
                    bottom: '16px',
                    zIndex: 1050,
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '14px',
                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
                    overflow: 'hidden',
                  }
                : {
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 1050,
                    width: 'min(360px, calc(100vw - 32px))',
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

          <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                      backgroundColor: '#ffffff',
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
      )}
    </div>
  );
};
