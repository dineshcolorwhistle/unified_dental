import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Clock,
  User,
  UserRound,
  FileText,
  Lock,
  Check,
  Loader2,
  AlertCircle,
  DollarSign,
  Info,
  Save,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { clinicServiceService, ClinicServiceItem } from '../../services/clinicServiceService';

interface SiblingPlanAppointment {
  id: string;
  appointmentNumber: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  doctor?: {
    id: string;
    name: string;
    email?: string;
    colorCode?: string | null;
  } | null;
  appointmentServices?: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    unitPrice: number | string;
    quantity: number;
  }>;
}

interface AppointmentDetail {
  id: string;
  appointmentNumber: string;
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason?: string | null;
  notes?: string | null;
  expectedAmount?: number | string | null;
  patientOdontogramId?: string | null;
  treatmentPlanGroupId?: string | null;
  treatmentPlanGroupName?: string | null;
  patient?: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
  } | null;
  doctor?: {
    id: string;
    name: string;
    email?: string;
    colorCode?: string | null;
  } | null;
  appointmentServices?: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    unitPrice: number | string;
    quantity: number;
  }>;
  siblingPlanAppointments?: SiblingPlanAppointment[];
}

interface DoctorOption {
  id: string;
  name: string;
  email?: string;
  roleName?: string;
  colorCode?: string | null;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
}

const APPOINTMENT_TYPES = [
  { value: 'CONSULTATION', labelEn: 'Consultation', labelEs: 'Consulta' },
  { value: 'FOLLOW_UP', labelEn: 'Follow-up', labelEs: 'Seguimiento' },
  { value: 'EMERGENCY', labelEn: 'Emergency', labelEs: 'Urgencia' },
  { value: 'CHECKUP', labelEn: 'Checkup / Evaluation', labelEs: 'Evaluación' },
  { value: 'PROCEDURE', labelEn: 'Procedure / Surgery', labelEs: 'Procedimiento' },
  { value: 'OTHER', labelEn: 'Other', labelEs: 'Otro' },
];

const STATUS_BADGE_MAP: Record<string, { labelEn: string; labelEs: string; bg: string; color: string; border: string }> = {
  SCHEDULED: {
    labelEn: 'Scheduled',
    labelEs: 'Programada',
    bg: 'rgba(56, 189, 248, 0.12)',
    color: '#0284c7',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  IN_PROGRESS: {
    labelEn: 'In Progress',
    labelEs: 'En Progreso',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#d97706',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  COMPLETED: {
    labelEn: 'Completed',
    labelEs: 'Completada',
    bg: 'rgba(99, 102, 241, 0.12)',
    color: '#4f46e5',
    border: 'rgba(99, 102, 241, 0.3)',
  },
  CANCELLED: {
    labelEn: 'Cancelled',
    labelEs: 'Cancelada',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#dc2626',
    border: 'rgba(239, 68, 68, 0.3)',
  },
};

const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateEndTimeString = (start: string, durationMins: number = 30): string => {
  if (!start) return '';
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + (m || 0) + durationMins;
  const eh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const em = String(total % 60).padStart(2, '0');
  return `${eh}:${em}`;
};

export const ClinicAppointmentEditPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isClinicAdmin } = useAuth();
  const { success, error } = useToast();

  const isSpanish = i18n.language?.startsWith('es');
  const canEdit = Boolean(isClinicAdmin);
  const returnTo = searchParams.get('returnTo');
  const returnPatientId = searchParams.get('patientId');

  const [loading, setLoading] = useState<boolean>(true);
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [originalDate, setOriginalDate] = useState<string>('');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorServices, setDoctorServices] = useState<ClinicServiceItem[]>([]);
  const [loadingDoctorServices, setLoadingDoctorServices] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'slots'>('form');

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    date: getTodayString(),
    startTime: '',
    endTime: '',
    durationMinutes: 30,
    type: 'CONSULTATION',
    serviceIds: [] as string[],
    expectedAmount: 0,
    notes: '',
  });

  useEffect(() => {
    const onResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchDoctorServices = useCallback(async (doctorId: string) => {
    if (!doctorId) {
      setDoctorServices([]);
      return;
    }
    try {
      setLoadingDoctorServices(true);
      const svcs = await clinicServiceService.getByDoctor(doctorId);
      setDoctorServices(svcs);
    } catch (err) {
      console.error('Failed to load doctor services:', err);
      setDoctorServices([]);
    } finally {
      setLoadingDoctorServices(false);
    }
  }, []);

  const fetchAvailableSlots = useCallback(
    async (docId: string, dateStr: string, duration: number) => {
      if (!docId || !dateStr) {
        setAvailableSlots([]);
        return;
      }
      try {
        setLoadingSlots(true);
        const query = new URLSearchParams({
          doctorId: docId,
          date: dateStr,
          durationMinutes: String(duration || 30),
        });
        if (appointmentId) query.append('excludeAppointmentId', appointmentId);

        const res = await api.get(`/clinic/appointments/working-hours/available-slots?${query.toString()}`);
        const raw = res.data?.slots || [];
        const parsed: SlotItem[] = Array.isArray(raw)
          ? raw.map((s: any) =>
              typeof s === 'string'
                ? { startTime: s, endTime: calculateEndTimeString(s, duration), available: true }
                : { startTime: s.startTime, endTime: s.endTime, available: s.available !== false },
            )
          : [];
        setAvailableSlots(parsed);
      } catch (err) {
        console.error('Failed to load available slots:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [appointmentId],
  );

  const loadAppointmentData = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      const [aptRes, docsRes] = await Promise.all([
        api.get(`/clinic/appointments/${appointmentId}`),
        api.get('/clinic/appointments/working-hours/doctors'),
      ]);

      const apt: AppointmentDetail = aptRes.data;
      setAppointment(apt);

      const docs = Array.isArray(docsRes.data) ? docsRes.data : docsRes.data?.doctors || [];
      setDoctors(docs);

      const dStr = apt.date ? apt.date.substring(0, 10) : getTodayString();
      setOriginalDate(dStr);

      const initialServiceIds = (apt.appointmentServices || []).map((s) => s.serviceId);
      setFormData({
        patientId: apt.patientId,
        doctorId: apt.doctorId,
        date: dStr,
        startTime: apt.startTime,
        endTime: apt.endTime,
        durationMinutes: apt.durationMinutes || 30,
        type: apt.type || 'CONSULTATION',
        serviceIds: initialServiceIds,
        expectedAmount: Number(apt.expectedAmount || 0),
        notes: apt.notes || '',
      });

      if (apt.doctorId) {
        fetchDoctorServices(apt.doctorId);
        if (apt.status === 'SCHEDULED' && dStr) {
          fetchAvailableSlots(apt.doctorId, dStr, apt.durationMinutes || 30);
        }
      }
    } catch (err: any) {
      console.error('Failed to load appointment:', err);
      error(err?.response?.data?.message || t('appointments.appointmentNotFound', 'Appointment not found.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, fetchDoctorServices, fetchAvailableSlots, error, t]);

  useEffect(() => {
    loadAppointmentData();
  }, [loadAppointmentData]);

  const handleBack = () => {
    const targetPatientId = returnPatientId || appointment?.patientId;
    if (returnTo === 'treatment-plan' && targetPatientId) {
      navigate(`/clinic/patients/${targetPatientId}/treatment-plan`);
      return;
    }
    navigate('/clinic/appointments');
  };

  const isSlotLocked = Boolean(
    appointment && (appointment.status === 'IN_PROGRESS' || appointment.status === 'COMPLETED'),
  );

  const doctorFormOptions: SearchableSelectOption[] = useMemo(
    () =>
      doctors.map((d) => ({
        value: d.id,
        label: `Dr. ${d.name}`,
        sublabel: d.roleName || (isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor'),
      })),
    [doctors, isSpanish],
  );

  const durationOptions: SearchableSelectOption[] = useMemo(
    () => [15, 30, 45, 60, 90, 120].map((mins) => ({
      value: String(mins),
      label: `${mins} ${isSpanish ? 'minutos' : 'minutes'}`,
    })),
    [isSpanish],
  );

  const typeOptions: SearchableSelectOption[] = useMemo(
    () =>
      APPOINTMENT_TYPES.map((tp) => ({
        value: tp.value,
        label: isSpanish ? tp.labelEs : tp.labelEn,
      })),
    [isSpanish],
  );

  const handleDurationChange = (newDur: number) => {
    const dur = newDur || 30;
    setFormData((prev) => ({
      ...prev,
      durationMinutes: dur,
      endTime: prev.startTime ? calculateEndTimeString(prev.startTime, dur) : '',
    }));
    if (formData.doctorId && formData.date) {
      fetchAvailableSlots(formData.doctorId, formData.date, dur);
    }
  };

  const handleSelectSlot = (slot: SlotItem) => {
    if (!slot.available || !canEdit || isSlotLocked) return;
    setFormData((prev) => ({
      ...prev,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
    if (isMobileScreen) {
      setActiveMobileTab('form');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !appointmentId) return;

    if (!formData.doctorId) {
      error(isSpanish ? 'Por favor selecciona un doctor' : 'Please select a doctor');
      return;
    }
    if (!isSlotLocked && formData.date !== originalDate && formData.date < getTodayString()) {
      error(isSpanish ? 'No se permiten citas en fechas pasadas' : 'Appointments cannot be scheduled on past dates');
      return;
    }
    if (!formData.startTime || !formData.endTime || formData.endTime <= formData.startTime) {
      error(isSpanish ? 'Selecciona un horario válido' : 'Please select a valid time slot');
      return;
    }
    if (!formData.serviceIds || formData.serviceIds.length === 0) {
      error(t('appointments.servicesRequired', 'Please select at least one service'));
      return;
    }

    try {
      setSubmitting(true);
      const payload = isSlotLocked
        ? {
            patientId: formData.patientId,
            doctorId: formData.doctorId,
            type: formData.type,
            serviceIds: formData.serviceIds,
            expectedAmount: formData.expectedAmount,
            notes: formData.notes,
          }
        : formData;

      await api.patch(`/clinic/appointments/${appointmentId}`, payload);
      success(t('appointments.updateSuccess', 'Appointment updated successfully'));
      await loadAppointmentData();
    } catch (err: any) {
      error(err?.response?.data?.message || t('appointments.updateFailed', 'Failed to update appointment'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '12px', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('common.loading', 'Loading...')}</span>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button type="button" onClick={handleBack} className="btn btn-secondary" style={{ width: 'fit-content', minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} />
          <span>{returnTo === 'treatment-plan' ? t('appointments.backToTreatmentPlan', 'Back to Treatment Plan') : t('appointments.backToAppointments', 'Back to Appointments')}</span>
        </button>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626' }}>
          <AlertCircle size={20} />
          <span>{t('appointments.appointmentNotFound', 'Appointment not found.')}</span>
        </div>
      </div>
    );
  }

  const stCfg = STATUS_BADGE_MAP[appointment.status] || STATUS_BADGE_MAP.SCHEDULED;
  const patientName = [appointment.patient?.firstName, appointment.patient?.fatherLastName, appointment.patient?.motherLastName]
    .filter(Boolean)
    .join(' ');
  const siblings = appointment.siblingPlanAppointments || [];
  const targetReturnPatientId = returnPatientId || appointment.patientId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Tooltip content={returnTo === 'treatment-plan' ? t('appointments.backToTreatmentPlan', 'Back to Treatment Plan') : t('appointments.backToAppointments', 'Back to Appointments')}>
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-secondary"
              style={{
                minWidth: '40px',
                minHeight: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ArrowLeft size={17} />
              <span>{returnTo === 'treatment-plan' ? t('appointments.backToTreatmentPlan', 'Back to Treatment Plan') : t('appointments.backToAppointments', 'Back to Appointments')}</span>
            </button>
          </Tooltip>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('appointments.editPageTitle', 'Edit Appointment')}
              </h1>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-700, #0f766e)',
                }}
              >
                #{appointment.appointmentNumber}
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: stCfg.bg,
                  color: stCfg.color,
                  border: `1px solid ${stCfg.border}`,
                }}
              >
                {isSpanish ? stCfg.labelEs : stCfg.labelEn}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('appointments.editPageSubtitle', 'Modify appointment schedule, doctor, services, or clinical notes')}
            </p>
          </div>
        </div>

        {(appointment.status === 'IN_PROGRESS' || appointment.status === 'COMPLETED') && (
          <button
            type="button"
            onClick={() => navigate(`/clinic/appointments/${appointment.id}/income`)}
            className="btn btn-secondary"
            style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669' }}
          >
            <DollarSign size={16} />
            <span>{t('appointments.incomeAction', 'Income & Billing')}</span>
          </button>
        )}
      </div>

      {/* Treatment Plan Context + Sibling Multi-Doctor Appointment Switcher */}
      {appointment.treatmentPlanGroupId && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Layers size={16} style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('appointments.linkedToPlan', 'Linked to Treatment Plan')}:
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(13, 148, 136, 0.1)',
                  color: 'var(--primary-700, #0f766e)',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                }}
              >
                {appointment.treatmentPlanGroupName || appointment.treatmentPlanGroupId}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/clinic/patients/${targetReturnPatientId}/treatment-plan`)}
              className="btn btn-secondary btn-sm"
              style={{ minHeight: '36px', fontSize: '12px' }}
            >
              {t('appointments.backToTreatmentPlan', 'Back to Treatment Plan')}
            </button>
          </div>

          {siblings.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {t('appointments.doctorAppointmentsSwitcher', 'Doctor Appointments in This Plan')} ({siblings.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {siblings.map((sib) => {
                  const isCurrent = sib.id === appointment.id;
                  const docColor = sib.doctor?.colorCode || '#0d9488';
                  const sibSt = STATUS_BADGE_MAP[sib.status] || STATUS_BADGE_MAP.SCHEDULED;
                  return (
                    <button
                      key={sib.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent) {
                          navigate(
                            `/clinic/appointments/${sib.id}/edit?returnTo=treatment-plan&patientId=${targetReturnPatientId}`,
                          );
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        minHeight: '40px',
                        borderRadius: '10px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        border: isCurrent ? '2px solid var(--primary-600, #0d9488)' : '1px solid var(--border-color)',
                        backgroundColor: isCurrent ? 'rgba(13, 148, 136, 0.08)' : 'var(--bg-surface-muted, #f8fafc)',
                        color: 'var(--text-heading)',
                        fontSize: '12.5px',
                        fontWeight: isCurrent ? 700 : 500,
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: docColor, flexShrink: 0 }} />
                      <span>Dr. {sib.doctor?.name || 'Doctor'}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                        #{sib.appointmentNumber}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {sib.date?.substring(0, 10)} {sib.startTime}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: sibSt.bg,
                          color: sibSt.color,
                          fontWeight: 700,
                        }}
                      >
                        {isSpanish ? sibSt.labelEs : sibSt.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!canEdit && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#b45309',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={16} />
          <span>{t('appointments.readOnlyNotice', 'Read-only view. Only Clinic Administrators can edit appointments.')}</span>
        </div>
      )}

      {/* Main Responsive Split Editor Card */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {isMobileScreen && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-muted)', padding: '6px 10px', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveMobileTab('form')}
              style={{
                flex: 1,
                minHeight: '40px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: activeMobileTab === 'form' ? 'var(--bg-card)' : 'transparent',
                color: activeMobileTab === 'form' ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              <FileText size={15} />
              <span>{t('appointments.tabDetails', 'Details & Services')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('slots')}
              style={{
                flex: 1,
                minHeight: '40px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: activeMobileTab === 'slots' ? 'var(--bg-card)' : 'transparent',
                color: activeMobileTab === 'slots' ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              <Clock size={15} />
              <span>{t('appointments.tabSlots', 'Available Slots')}</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: isMobileScreen ? 'column' : 'row' }}>
          {/* Left Pane: Form */}
          {(!isMobileScreen || activeMobileTab === 'form') && (
            <form
              onSubmit={handleSubmit}
              style={{
                width: isMobileScreen ? '100%' : '54%',
                borderRight: isMobileScreen ? 'none' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Patient Summary Box */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(13, 148, 136, 0.12)',
                      color: 'var(--primary-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('appointments.patientInfo', 'Patient Information')}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {patientName || '—'}{' '}
                      {appointment.patient?.recordNumber && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          (#{appointment.patient.recordNumber})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Doctor Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                    {t('appointments.assignedDoctor', 'Assigned Doctor')} *
                  </label>
                  <SearchableSelect
                    options={doctorFormOptions}
                    value={formData.doctorId}
                    disabled={!canEdit || isSlotLocked}
                    onChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        doctorId: val,
                        startTime: '',
                        endTime: '',
                        serviceIds: [],
                        expectedAmount: 0,
                      }));
                      if (val) {
                        fetchDoctorServices(val);
                        if (formData.date) {
                          fetchAvailableSlots(val, formData.date, formData.durationMinutes || 30);
                        }
                      } else {
                        setDoctorServices([]);
                        setAvailableSlots([]);
                      }
                    }}
                    icon={<UserRound size={14} />}
                  />
                </div>

                {isSlotLocked && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#b45309',
                      fontSize: '12.5px',
                    }}
                  >
                    <Lock size={15} style={{ flexShrink: 0 }} />
                    <span>{t('appointments.slotLockedNotice', 'This appointment has already started. The date and time slot are locked and cannot be changed.')}</span>
                  </div>
                )}

                {/* Date & Duration */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobileScreen ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {isSpanish ? 'Fecha' : 'Date'} *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.date}
                      min={!isSlotLocked && formData.date !== originalDate ? getTodayString() : undefined}
                      disabled={!canEdit || isSlotLocked}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData((prev) => ({ ...prev, date: newDate, startTime: '', endTime: '' }));
                        if (formData.doctorId && newDate) {
                          fetchAvailableSlots(formData.doctorId, newDate, formData.durationMinutes || 30);
                        }
                      }}
                      required
                      style={{ width: '100%', minHeight: '40px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {isSpanish ? 'Duración' : 'Duration'}
                    </label>
                    <SearchableSelect
                      options={durationOptions}
                      value={String(formData.durationMinutes || 30)}
                      disabled={!canEdit || isSlotLocked}
                      onChange={(val) => handleDurationChange(Number(val))}
                      icon={<Clock size={14} />}
                    />
                  </div>
                </div>

                {/* Services Multi-Select */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('appointments.services', 'Services')} *
                    </label>
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#059669',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      ${Number(formData.expectedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {loadingDoctorServices ? (
                    <div style={{ padding: '10px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {doctorServices.map((svc) => {
                        const isSelected = formData.serviceIds.includes(svc.id);
                        return (
                          <label
                            key={svc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: '40px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                              border: isSelected ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid transparent',
                              cursor: canEdit ? 'pointer' : 'default',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canEdit}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const newIds = checked
                                    ? [...formData.serviceIds, svc.id]
                                    : formData.serviceIds.filter((id) => id !== svc.id);
                                  const newTotal = doctorServices
                                    .filter((s) => newIds.includes(s.id))
                                    .reduce((acc, s) => acc + Number(s.price), 0);
                                  setFormData((prev) => ({ ...prev, serviceIds: newIds, expectedAmount: newTotal }));
                                }}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>{svc.name}</span>
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: isSelected ? '#059669' : 'var(--text-muted)' }}>
                              ${Number(svc.price).toFixed(2)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Start & End Time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {t('appointments.startTime', 'Start Time')} *
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={formData.startTime}
                      readOnly
                      style={{ width: '100%', minHeight: '40px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'var(--bg-surface-muted)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {t('appointments.endTime', 'End Time')} *
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={formData.endTime}
                      readOnly
                      style={{ width: '100%', minHeight: '40px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'var(--bg-surface-muted)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Appointment Type & Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobileScreen ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {t('appointments.appointmentType', 'Appointment Type')}
                    </label>
                    <SearchableSelect
                      options={typeOptions}
                      value={formData.type}
                      disabled={!canEdit}
                      onChange={(val) => setFormData((prev) => ({ ...prev, type: val }))}
                      icon={<FileText size={14} />}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                      {isSpanish ? 'Notas Clínicas' : 'Notes'}
                    </label>
                    <textarea
                      rows={3}
                      className="input"
                      disabled={!canEdit}
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button type="button" onClick={handleBack} className="btn btn-secondary" style={{ minHeight: '42px', padding: '0 18px' }}>
                  {t('common.cancel', 'Cancel')}
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ minHeight: '42px', padding: '0 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{submitting ? t('appointments.savingChanges', 'Saving Changes...') : t('appointments.saveChanges', 'Save Changes')}</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Right Pane: Available Slots */}
          {(!isMobileScreen || activeMobileTab === 'slots') && (
            <div
              style={{
                width: isMobileScreen ? '100%' : '46%',
                backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarCheck size={16} style={{ color: 'var(--primary-600)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('patientTreatmentPlan.availableSlots', 'Available Slots')} ({formData.durationMinutes} min)
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                    {availableSlots.filter((s) => s.available).length} {t('patientTreatmentPlan.slotsFree', 'free')}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {t('appointments.selectSlotPrompt', 'Click on an available slot to update the appointment time.')}
                </p>
              </div>

              <div style={{ padding: '18px', flex: 1 }}>
                {isSlotLocked ? (
                  <div style={{ padding: '24px', textAlign: 'center', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#b45309', fontSize: '13px' }}>
                    <Lock size={24} style={{ margin: '0 auto 8px' }} />
                    <div>{t('appointments.slotLockedNotice', 'This appointment has already started. The date and time slot are locked and cannot be changed.')}</div>
                  </div>
                ) : loadingSlots ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
                    <span>{t('patientTreatmentPlan.checkingSlots', 'Checking availability...')}</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#b45309', fontSize: '13px' }}>
                    {t('patientTreatmentPlan.noSlotsAvailable', 'No available slots for this doctor on the selected date.')}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '10px' }}>
                    {availableSlots.map((slot) => {
                      const isSelected = formData.startTime === slot.startTime;
                      if (!slot.available) {
                        return (
                          <div
                            key={slot.startTime}
                            style={{
                              minHeight: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'rgba(239, 68, 68, 0.04)',
                              color: 'var(--text-muted)',
                              fontSize: '12px',
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            }}
                          >
                            <Lock size={12} />
                            <span>{slot.startTime}–{slot.endTime}</span>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleSelectSlot(slot)}
                          style={{
                            minHeight: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            borderRadius: '999px',
                            border: isSelected ? '1.5px solid var(--primary-600, #0d9488)' : '1px solid rgba(13, 148, 136, 0.4)',
                            backgroundColor: isSelected ? 'var(--primary-600, #0d9488)' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--primary-700, #0f766e)',
                            fontSize: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: canEdit ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {isSelected && <Check size={13} />}
                          <span>{slot.startTime}–{slot.endTime}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
