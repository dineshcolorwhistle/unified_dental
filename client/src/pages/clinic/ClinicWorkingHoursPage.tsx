import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import {
  Clock,
  Building2,
  User,
  Save,
  Copy,
  Shield,
  Calendar,
  Coffee,
  CheckCircle2,
  UserRound,
  Sparkles,
} from 'lucide-react';

interface DaySchedule {
  dayOfWeek: number;
  isOpen?: boolean;
  isWorking?: boolean;
  startTime: string;
  endTime: string;
  hasLunchBreak: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  slotDurationMinutes?: number;
}

interface DoctorSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleName?: string;
  daysConfigured: number;
}

const DAYS_OF_WEEK = [
  { day: 1, nameEn: 'Monday', nameEs: 'Lunes' },
  { day: 2, nameEn: 'Tuesday', nameEs: 'Martes' },
  { day: 3, nameEn: 'Wednesday', nameEs: 'Miércoles' },
  { day: 4, nameEn: 'Thursday', nameEs: 'Jueves' },
  { day: 5, nameEn: 'Friday', nameEs: 'Viernes' },
  { day: 6, nameEn: 'Saturday', nameEs: 'Sábado' },
  { day: 7, nameEn: 'Sunday', nameEs: 'Domingo' },
];

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map((d) => ({
  dayOfWeek: d.day,
  isOpen: d.day <= 5,
  isWorking: d.day <= 5,
  startTime: '09:00',
  endTime: '18:00',
  hasLunchBreak: true,
  lunchStartTime: '13:00',
  lunchEndTime: '14:00',
  slotDurationMinutes: 30,
}));

// Helper to compute net hours for a day
const computeDailyHours = (
  isActive: boolean,
  start: string,
  end: string,
  hasLunch: boolean,
  lunchStart?: string,
  lunchEnd?: string,
): { label: string; minutes: number } => {
  if (!isActive) return { label: '0h', minutes: 0 };
  const [sh, sm] = (start || '09:00').split(':').map(Number);
  const [eh, em] = (end || '18:00').split(':').map(Number);
  let total = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
  if (total < 0) total = 0;

  if (hasLunch && lunchStart && lunchEnd) {
    const [lsh, lsm] = lunchStart.split(':').map(Number);
    const [leh, lem] = lunchEnd.split(':').map(Number);
    const lTotal = (leh * 60 + (lem || 0)) - (lsh * 60 + (lsm || 0));
    if (lTotal > 0 && lTotal < total) {
      total -= lTotal;
    }
  }

  const h = Math.floor(total / 60);
  const m = total % 60;
  const label = m > 0 ? `${h}h ${m}m` : `${h}h`;
  return { label, minutes: total };
};

export const ClinicWorkingHoursPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { isClinicAdmin } = useAuth();
  const { success, error } = useToast();

  const isSpanish = i18n.language?.startsWith('es');
  const canEdit = Boolean(isClinicAdmin);

  const [activeTab, setActiveTab] = useState<'clinic' | 'doctors'>('clinic');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Clinic Hours State
  const [clinicSchedule, setClinicSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [slotDuration, setSlotDuration] = useState<number>(30);

  // Doctors & Doctor Schedule State
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctorSchedule, setDoctorSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [doctorLoading, setDoctorLoading] = useState<boolean>(false);

  // Fetch Clinic Schedule
  const fetchClinicSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/clinic/appointments/working-hours/clinic');
      const raw = res.data;
      const data = Array.isArray(raw) ? raw : (raw?.schedule || []);

      if (Array.isArray(data) && data.length > 0) {
        const merged = DAYS_OF_WEEK.map((d) => {
          const found = data.find((item: any) => item.dayOfWeek === d.day);
          return (
            found || {
              dayOfWeek: d.day,
              isOpen: false,
              startTime: '09:00',
              endTime: '18:00',
              hasLunchBreak: true,
              lunchStartTime: '13:00',
              lunchEndTime: '14:00',
              slotDurationMinutes: 30,
            }
          );
        });
        setClinicSchedule(merged);
        if (data[0]?.slotDurationMinutes) {
          setSlotDuration(data[0].slotDurationMinutes);
        }
      }
    } catch (err: any) {
      console.error('Failed to load clinic working hours:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Doctors List
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/clinic/appointments/working-hours/doctors');
      const raw = res.data;
      const docs = Array.isArray(raw) ? raw : (raw?.doctors || []);
      setDoctors(docs);
      if (docs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load doctors list:', err);
    }
  }, [selectedDoctorId]);

  // Fetch Specific Doctor Schedule
  const fetchDoctorSchedule = useCallback(async (docId: string) => {
    if (!docId) return;
    try {
      setDoctorLoading(true);
      const res = await api.get(`/clinic/appointments/working-hours/doctors/${docId}`);
      const raw = res.data;
      const data = Array.isArray(raw) ? raw : (raw?.schedule || []);

      if (Array.isArray(data) && data.length > 0) {
        const merged = DAYS_OF_WEEK.map((d) => {
          const found = data.find((item: any) => item.dayOfWeek === d.day);
          return (
            found || {
              dayOfWeek: d.day,
              isWorking: false,
              startTime: '09:00',
              endTime: '17:00',
              hasLunchBreak: true,
              lunchStartTime: '13:00',
              lunchEndTime: '14:00',
            }
          );
        });
        setDoctorSchedule(merged);
      }
    } catch (err: any) {
      console.error('Failed to load doctor working hours:', err);
    } finally {
      setDoctorLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClinicSchedule();
    fetchDoctors();
  }, [fetchClinicSchedule, fetchDoctors]);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchDoctorSchedule(selectedDoctorId);
    }
  }, [selectedDoctorId, fetchDoctorSchedule]);

  // Clinic Schedule Handlers
  const handleClinicChange = (dayOfWeek: number, field: keyof DaySchedule, value: any) => {
    if (!canEdit) return;
    setClinicSchedule((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day)),
    );
  };

  const copyClinicMondayToWeekdays = () => {
    if (!canEdit) return;
    const monday = clinicSchedule.find((d) => d.dayOfWeek === 1);
    if (!monday) return;
    setClinicSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek >= 2 && d.dayOfWeek <= 5 ? { ...monday, dayOfWeek: d.dayOfWeek } : d)),
    );
    success(
      isSpanish
        ? 'Horario de Lunes copiado a Martes-Viernes'
        : 'Monday schedule copied to all weekdays (Tue-Fri)',
    );
  };

  const handleSaveClinicSchedule = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      const payload = {
        schedule: clinicSchedule.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isOpen: Boolean(d.isOpen),
          startTime: d.startTime,
          endTime: d.endTime,
          hasLunchBreak: Boolean(d.hasLunchBreak),
          lunchStartTime: d.hasLunchBreak ? d.lunchStartTime : null,
          lunchEndTime: d.hasLunchBreak ? d.lunchEndTime : null,
          slotDurationMinutes: Number(slotDuration) || 30,
        })),
      };
      await api.put('/clinic/appointments/working-hours/clinic', payload);
      success(
        isSpanish
          ? 'Horario de la clínica guardado exitosamente'
          : 'Clinic working hours saved successfully',
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save clinic hours';
      error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Doctor Schedule Handlers
  const handleDoctorChange = (dayOfWeek: number, field: keyof DaySchedule, value: any) => {
    if (!canEdit) return;
    setDoctorSchedule((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day)),
    );
  };

  const handleSaveDoctorSchedule = async () => {
    if (!canEdit || !selectedDoctorId) return;
    try {
      setSaving(true);
      const payload = {
        doctorId: selectedDoctorId,
        schedule: doctorSchedule.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorking: Boolean(d.isWorking),
          startTime: d.startTime,
          endTime: d.endTime,
          hasLunchBreak: Boolean(d.hasLunchBreak),
          lunchStartTime: d.hasLunchBreak ? d.lunchStartTime : null,
          lunchEndTime: d.hasLunchBreak ? d.lunchEndTime : null,
        })),
      };
      await api.put(`/clinic/appointments/working-hours/doctors/${selectedDoctorId}`, payload);
      success(
        isSpanish
          ? 'Horario del doctor guardado exitosamente'
          : 'Doctor working hours saved successfully',
      );
      fetchDoctors();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save doctor schedule';
      error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Searchable Select Options for Doctors
  const doctorOptions: SearchableSelectOption[] = useMemo(() => {
    return doctors.map((doc) => ({
      value: doc.id,
      label: `Dr. ${doc.name}`,
      sublabel: `${doc.roleName || (isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor')} • ${doc.daysConfigured || 0} ${isSpanish ? 'días' : 'days'}`,
      badge: `${doc.daysConfigured || 0}d`,
    }));
  }, [doctors, isSpanish]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId),
    [doctors, selectedDoctorId],
  );

  // Clinic Weekly KPI Stats
  const clinicWeeklyStats = useMemo(() => {
    let openDays = 0;
    let totalMinutes = 0;
    clinicSchedule.forEach((d) => {
      if (d.isOpen) {
        openDays++;
        const { minutes } = computeDailyHours(
          true,
          d.startTime,
          d.endTime,
          d.hasLunchBreak,
          d.lunchStartTime,
          d.lunchEndTime,
        );
        totalMinutes += minutes;
      }
    });
    const totalHours = (totalMinutes / 60).toFixed(1);
    return { openDays, totalHours };
  }, [clinicSchedule]);

  // Doctor Weekly KPI Stats
  const doctorWeeklyStats = useMemo(() => {
    let activeDays = 0;
    let totalMinutes = 0;
    doctorSchedule.forEach((d) => {
      if (d.isWorking) {
        activeDays++;
        const { minutes } = computeDailyHours(
          true,
          d.startTime,
          d.endTime,
          d.hasLunchBreak,
          d.lunchStartTime,
          d.lunchEndTime,
        );
        totalMinutes += minutes;
      }
    });
    const totalHours = (totalMinutes / 60).toFixed(1);
    return { activeDays, totalHours };
  }, [doctorSchedule]);

  // Slot duration options
  const slotOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: '15', label: `15 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '20', label: `20 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '30', label: `30 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '45', label: `45 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '60', label: `60 ${isSpanish ? 'minutos' : 'minutes'}` },
    ],
    [isSpanish],
  );

  return (
    <div className="clinic-working-hours-page" style={{ padding: '4px 0 32px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <Clock size={20} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
              {isSpanish ? 'Horarios de Trabajo' : 'Working Hours'}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {isSpanish
              ? 'Configura los horarios operativos de la clínica y las jornadas de los especialistas.'
              : 'Configure clinic operating schedule, break periods, and individual specialist working hours.'}
          </p>
        </div>

        {/* Read-Only Notice for Tenant Admin, Staff, Doctor */}
        {!canEdit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              fontSize: '12.5px',
              color: 'var(--amber-500)',
              fontWeight: 500,
            }}
          >
            <Shield size={16} />
            <span>
              {isSpanish
                ? 'Vista de solo lectura: Solo los Administradores de Clínica pueden modificar horarios'
                : 'Read-only view: Only Clinic Administrators can configure working hours'}
            </span>
          </div>
        )}
      </div>

      {/* Modern Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '24px',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('clinic')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'clinic' ? '2px solid var(--primary-600)' : '2px solid transparent',
            color: activeTab === 'clinic' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'clinic' ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Building2 size={16} />
          <span>{isSpanish ? 'Horario de la Clínica' : 'Clinic Operating Hours'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('doctors')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'doctors' ? '2px solid var(--primary-600)' : '2px solid transparent',
            color: activeTab === 'doctors' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'doctors' ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <User size={16} />
          <span>{isSpanish ? 'Horarios por Doctor' : 'Doctor Working Hours'}</span>
          {doctors.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'doctors' ? 'var(--primary-600)' : 'rgba(148, 163, 184, 0.2)',
                color: activeTab === 'doctors' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {doctors.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CLINIC OPERATING HOURS */}
      {activeTab === 'clinic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Executive Overview Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {isSpanish ? 'Días Operativos' : 'Operating Days'}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {clinicWeeklyStats.openDays} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>/ 7 {isSpanish ? 'días' : 'days'}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {isSpanish ? 'Horas Semanales' : 'Weekly Capacity'}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {clinicWeeklyStats.totalHours} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>{isSpanish ? 'hrs netas' : 'hrs net'}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(234, 179, 8, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ca8a04',
                }}
              >
                <Coffee size={20} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {isSpanish ? 'Receso de Almuerzo' : 'Lunch Break'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
                  13:00 — 14:00 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>(1h)</span>
                </div>
              </div>
            </div>

            {/* Slot Duration KPI card — Hidden for now */}
            {false && (
              <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1',
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {isSpanish ? 'Intervalo de Turno' : 'Slot Duration'}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                    {slotDuration} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>min</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Controls Toolbar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            {/* Slot duration config — Hidden for now; can be enabled later if needed */}
            {false && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {isSpanish ? 'Duración de Cita Predeterminada:' : 'Default Slot Duration:'}
                </span>
                <div style={{ width: '140px' }}>
                  <SearchableSelect
                    options={slotOptions}
                    value={String(slotDuration)}
                    onChange={(val) => setSlotDuration(Number(val))}
                    disabled={!canEdit}
                    placeholder="30 min"
                  />
                </div>
              </div>
            )}

            {/* Quick Actions (Copy Monday removed as per instruction) */}
            {canEdit && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={handleSaveClinicSchedule}
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 16px' }}
                >
                  <Save size={14} />
                  <span>
                    {saving
                      ? (isSpanish ? 'Guardando...' : 'Saving...')
                      : isSpanish
                      ? 'Guardar Horario'
                      : 'Save Operating Hours'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Professional 7-Day Schedule Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DAYS_OF_WEEK.map((d) => {
              const dayConfig = clinicSchedule.find((item) => item.dayOfWeek === d.day) || {
                dayOfWeek: d.day,
                isOpen: false,
                startTime: '09:00',
                endTime: '18:00',
                hasLunchBreak: true,
                lunchStartTime: '13:00',
                lunchEndTime: '14:00',
              };

              const dailyHours = computeDailyHours(
                Boolean(dayConfig.isOpen),
                dayConfig.startTime,
                dayConfig.endTime,
                dayConfig.hasLunchBreak,
                dayConfig.lunchStartTime,
                dayConfig.lunchEndTime,
              );

              return (
                <div
                  key={d.day}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: `1px solid ${dayConfig.isOpen ? 'var(--border-color)' : 'rgba(148, 163, 184, 0.15)'}`,
                    backgroundColor: dayConfig.isOpen ? 'var(--bg-card)' : 'rgba(148, 163, 184, 0.04)',
                    boxShadow: dayConfig.isOpen ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Left Column: Switch + Day Name + Status Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '200px' }}>
                    <label
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '44px',
                        height: '24px',
                        cursor: canEdit ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(dayConfig.isOpen)}
                        disabled={!canEdit}
                        onChange={(e) => handleClinicChange(d.day, 'isOpen', e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: dayConfig.isOpen ? 'var(--primary-600)' : '#cbd5e1',
                          borderRadius: '24px',
                          transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            height: '18px',
                            width: '18px',
                            left: dayConfig.isOpen ? '22px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </span>
                    </label>

                    <div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: dayConfig.isOpen ? 'var(--text-heading)' : 'var(--text-muted)',
                        }}
                      >
                        {isSpanish ? d.nameEs : d.nameEn}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 8px',
                          borderRadius: '10px',
                          marginTop: '2px',
                          backgroundColor: dayConfig.isOpen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.14)',
                          color: dayConfig.isOpen ? '#10b981' : 'var(--text-muted)',
                          border: dayConfig.isOpen ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid transparent',
                        }}
                      >
                        {dayConfig.isOpen ? (isSpanish ? '● Abierto' : '● Open') : (isSpanish ? 'Cerrado' : 'Closed')}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Operational Hours */}
                  {dayConfig.isOpen ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '12px',
                        flex: '1 1 320px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {isSpanish ? 'Apertura' : 'Open'}
                        </span>
                        <input
                          type="time"
                          className="input"
                          disabled={!canEdit}
                          value={dayConfig.startTime || '09:00'}
                          onChange={(e) => handleClinicChange(d.day, 'startTime', e.target.value)}
                          style={{
                            height: '38px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '8px',
                          }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {isSpanish ? 'Cierre' : 'Close'}
                        </span>
                        <input
                          type="time"
                          className="input"
                          disabled={!canEdit}
                          value={dayConfig.endTime || '18:00'}
                          onChange={(e) => handleClinicChange(d.day, 'endTime', e.target.value)}
                          style={{
                            height: '38px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '8px',
                          }}
                        />
                      </div>

                      <span
                        style={{
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          color: '#0284c7',
                          fontWeight: 600,
                        }}
                      >
                        {dailyHours.label} {isSpanish ? 'netas' : 'net'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ flex: '1 1 320px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Coffee size={15} style={{ opacity: 0.6 }} />
                      <span>{isSpanish ? 'Cerrado todo el día' : 'Closed all day'}</span>
                    </div>
                  )}

                  {/* Right Column: Lunch Break */}
                  {dayConfig.isOpen && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '10px',
                        paddingLeft: '16px',
                        borderLeft: '1px solid var(--border-color)',
                        minWidth: '280px',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: canEdit ? 'pointer' : 'default',
                          color: dayConfig.hasLunchBreak ? 'var(--text-heading)' : 'var(--text-muted)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(dayConfig.hasLunchBreak)}
                          disabled={!canEdit}
                          onChange={(e) => handleClinicChange(d.day, 'hasLunchBreak', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                        />
                        <Coffee size={14} style={{ color: '#ca8a04' }} />
                        <span>{isSpanish ? 'Almuerzo' : 'Lunch Break'}</span>
                      </label>

                      {dayConfig.hasLunchBreak ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="time"
                            className="input"
                            disabled={!canEdit}
                            value={dayConfig.lunchStartTime || '13:00'}
                            onChange={(e) => handleClinicChange(d.day, 'lunchStartTime', e.target.value)}
                            style={{
                              height: '34px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              borderRadius: '6px',
                            }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                          <input
                            type="time"
                            className="input"
                            disabled={!canEdit}
                            value={dayConfig.lunchEndTime || '14:00'}
                            onChange={(e) => handleClinicChange(d.day, 'lunchEndTime', e.target.value)}
                            style={{
                              height: '34px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              borderRadius: '6px',
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {isSpanish ? 'Sin receso programado' : 'No lunch break'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR WORKING HOURS */}
      {activeTab === 'doctors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Doctor Selector & Header */}
          <div
            className="card"
            style={{
              padding: '18px 22px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            {/* Searchable Doctor Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '280px', flex: '1 1 360px', maxWidth: '520px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {isSpanish ? 'Seleccionar Especialista / Doctor *' : 'Select Specialist / Doctor *'}
              </label>
              <SearchableSelect
                options={doctorOptions}
                value={selectedDoctorId}
                onChange={(val) => setSelectedDoctorId(val)}
                placeholder={isSpanish ? 'Seleccionar doctor...' : 'Select doctor...'}
                searchPlaceholder={isSpanish ? 'Buscar especialista por nombre...' : 'Search doctor by name...'}
                icon={<UserRound size={15} />}
              />
            </div>

            {/* Save Doctor Hours Button (Copy buttons permanently removed as per user instruction) */}
            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSaveDoctorSchedule}
                  disabled={saving || !selectedDoctorId}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '40px',
                    padding: '0 20px',
                    fontWeight: 600,
                    borderRadius: '10px',
                  }}
                >
                  <Save size={16} />
                  <span>
                    {saving
                      ? (isSpanish ? 'Guardando Horario...' : 'Saving Schedule...')
                      : isSpanish
                      ? 'Guardar Horario del Doctor'
                      : 'Save Doctor Hours'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Selected Doctor Summary Card */}
          {selectedDoctor && (
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                  }}
                >
                  {selectedDoctor.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    Dr. {selectedDoctor.name}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {selectedDoctor.email} • {selectedDoctor.roleName || (isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Calendar size={13} />
                  <span>
                    {doctorWeeklyStats.activeDays} {isSpanish ? 'días laborables' : 'working days'}
                  </span>
                </div>

                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Clock size={13} />
                  <span>
                    {doctorWeeklyStats.totalHours} {isSpanish ? 'hrs semanales' : 'hrs / week'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Doctor Schedule List */}
          {doctorLoading ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={28} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 12px', opacity: 0.6 }} />
              <div>{isSpanish ? 'Cargando horario del doctor...' : 'Loading doctor schedule...'}</div>
            </div>
          ) : !selectedDoctorId ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserRound size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div>{isSpanish ? 'Por favor selecciona un doctor para ver su horario.' : 'Please select a doctor to configure their schedule.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DAYS_OF_WEEK.map((d) => {
                const dayConfig = doctorSchedule.find((item) => item.dayOfWeek === d.day) || {
                  dayOfWeek: d.day,
                  isWorking: false,
                  startTime: '09:00',
                  endTime: '17:00',
                  hasLunchBreak: true,
                  lunchStartTime: '13:00',
                  lunchEndTime: '14:00',
                };

                const dailyHours = computeDailyHours(
                  Boolean(dayConfig.isWorking),
                  dayConfig.startTime,
                  dayConfig.endTime,
                  dayConfig.hasLunchBreak,
                  dayConfig.lunchStartTime,
                  dayConfig.lunchEndTime,
                );

                return (
                  <div
                    key={d.day}
                    className="card"
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: `1px solid ${dayConfig.isWorking ? 'var(--border-color)' : 'rgba(148, 163, 184, 0.15)'}`,
                      backgroundColor: dayConfig.isWorking ? 'var(--bg-card)' : 'rgba(148, 163, 184, 0.04)',
                      boxShadow: dayConfig.isWorking ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Left Column: Toggle + Day Name + Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '200px' }}>
                      <label
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '44px',
                          height: '24px',
                          cursor: canEdit ? 'pointer' : 'not-allowed',
                          flexShrink: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(dayConfig.isWorking)}
                          disabled={!canEdit}
                          onChange={(e) => handleDoctorChange(d.day, 'isWorking', e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: dayConfig.isWorking ? 'var(--primary-600)' : '#cbd5e1',
                            borderRadius: '24px',
                            transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              height: '18px',
                              width: '18px',
                              left: dayConfig.isWorking ? '22px' : '3px',
                              bottom: '3px',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </span>
                      </label>

                      <div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: dayConfig.isWorking ? 'var(--text-heading)' : 'var(--text-muted)',
                          }}
                        >
                          {isSpanish ? d.nameEs : d.nameEn}
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 8px',
                            borderRadius: '10px',
                            marginTop: '2px',
                            backgroundColor: dayConfig.isWorking ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.14)',
                            color: dayConfig.isWorking ? '#10b981' : 'var(--text-muted)',
                            border: dayConfig.isWorking ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid transparent',
                          }}
                        >
                          {dayConfig.isWorking ? (isSpanish ? '● Laborable' : '● Working Day') : (isSpanish ? 'Descanso' : 'Day Off')}
                        </span>
                      </div>
                    </div>

                    {/* Middle Column: Operational Hours */}
                    {dayConfig.isWorking ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '12px',
                          flex: '1 1 320px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {isSpanish ? 'Entrada' : 'Start'}
                          </span>
                          <input
                            type="time"
                            className="input"
                            disabled={!canEdit}
                            value={dayConfig.startTime || '09:00'}
                            onChange={(e) => handleDoctorChange(d.day, 'startTime', e.target.value)}
                            style={{
                              height: '38px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              fontWeight: 600,
                              borderRadius: '8px',
                            }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {isSpanish ? 'Salida' : 'End'}
                          </span>
                          <input
                            type="time"
                            className="input"
                            disabled={!canEdit}
                            value={dayConfig.endTime || '17:00'}
                            onChange={(e) => handleDoctorChange(d.day, 'endTime', e.target.value)}
                            style={{
                              height: '38px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              fontWeight: 600,
                              borderRadius: '8px',
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: '11.5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: '#0284c7',
                            fontWeight: 600,
                          }}
                        >
                          {dailyHours.label}
                        </span>
                      </div>
                    ) : (
                      <div style={{ flex: '1 1 320px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Coffee size={15} style={{ opacity: 0.6 }} />
                        <span>{isSpanish ? 'No labora este día' : 'Day off'}</span>
                      </div>
                    )}

                    {/* Right Column: Lunch Break */}
                    {dayConfig.isWorking && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '10px',
                          paddingLeft: '16px',
                          borderLeft: '1px solid var(--border-color)',
                          minWidth: '280px',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: canEdit ? 'pointer' : 'default',
                            color: dayConfig.hasLunchBreak ? 'var(--text-heading)' : 'var(--text-muted)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(dayConfig.hasLunchBreak)}
                            disabled={!canEdit}
                            onChange={(e) => handleDoctorChange(d.day, 'hasLunchBreak', e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                          />
                          <Coffee size={14} style={{ color: '#ca8a04' }} />
                          <span>{isSpanish ? 'Almuerzo' : 'Lunch Break'}</span>
                        </label>

                        {dayConfig.hasLunchBreak ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="time"
                              className="input"
                              disabled={!canEdit}
                              value={dayConfig.lunchStartTime || '13:00'}
                              onChange={(e) => handleDoctorChange(d.day, 'lunchStartTime', e.target.value)}
                              style={{
                                height: '34px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                borderRadius: '6px',
                              }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                            <input
                              type="time"
                              className="input"
                              disabled={!canEdit}
                              value={dayConfig.lunchEndTime || '14:00'}
                              onChange={(e) => handleDoctorChange(d.day, 'lunchEndTime', e.target.value)}
                              style={{
                                height: '34px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                borderRadius: '6px',
                              }}
                            />
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {isSpanish ? 'Sin receso de almuerzo' : 'No lunch break'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
