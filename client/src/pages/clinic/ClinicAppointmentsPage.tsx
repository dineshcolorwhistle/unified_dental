import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { DateRangePicker, DateRange } from '../../components/common/DateRangePicker';
import { clinicServiceService, ClinicServiceItem } from '../../services/clinicServiceService';
import {
  CalendarCheck,
  Calendar as CalendarIcon,
  Clock,
  User,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  FileText,
  UserRound,
  Shield,
  Coffee,
  Check,
  UserPlus,
  Info,
  Play,
  Lock,
  XCircle,
  RotateCcw,
  DollarSign,
} from 'lucide-react';

interface PatientOption {
  id: string;
  recordNumber: string;
  firstName: string;
  fatherLastName?: string | null;
  motherLastName?: string | null;
  phoneNumber?: string | null;
}

interface DoctorOption {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleName?: string;
  colorCode?: string | null;
}

interface AppointmentItem {
  id: string;
  appointmentNumber: string;
  tenantId: string;
  branchId?: string | null;
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  startedById?: string | null;
  endedById?: string | null;
  startedBy?: { id: string; name: string } | null;
  endedBy?: { id: string; name: string } | null;
  type: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  patient?: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
    phoneNumber?: string | null;
    phoneCountryCode?: string | null;
  } | null;
  doctor?: {
    id: string;
    name: string;
    email: string;
    colorCode?: string | null;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  expectedAmount?: number | string | null;
  appointmentServices?: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    unitPrice: number | string;
    quantity: number;
  }>;
  incomeRecord?: {
    id: string;
    status: string;
    grandTotal: number | string;
    totalPaid: number | string;
    balanceDue: number | string;
  } | null;
  createdAt?: string;
}

interface AppointmentStats {
  total: number;
  todayTotal?: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

const APPOINTMENT_TYPES = [
  { value: 'CONSULTATION', labelEn: 'Consultation', labelEs: 'Consulta' },
  { value: 'FOLLOW_UP', labelEn: 'Follow-up', labelEs: 'Seguimiento' },
  { value: 'EMERGENCY', labelEn: 'Emergency', labelEs: 'Urgencia' },
  { value: 'CHECKUP', labelEn: 'Checkup / Evaluation', labelEs: 'Evaluación' },
  { value: 'PROCEDURE', labelEn: 'Procedure / Surgery', labelEs: 'Procedimiento' },
  { value: 'OTHER', labelEn: 'Other', labelEs: 'Otro' },
];

const getAppointmentTypeLabel = (type: string | null | undefined, isSpanish: boolean): string => {
  if (!type) return isSpanish ? 'Consulta' : 'Consultation';
  const found = APPOINTMENT_TYPES.find((t) => t.value === type);
  if (found) return isSpanish ? found.labelEs : found.labelEn;
  if (type === 'CLEANING') return isSpanish ? 'Limpieza' : 'Cleaning';
  return type.replace(/_/g, ' ');
};

const STATUS_CONFIG: Record<
  string,
  { labelEn: string; labelEs: string; bg: string; color: string; border: string }
> = {
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

const COUNTRY_DIALING_CODES: SearchableSelectOption[] = [
  { value: '+52', label: '+52' },
  { value: '+1', label: '+1' },
  { value: '+51', label: '+51' },
  { value: '+34', label: '+34' },
  { value: '+57', label: '+57' },
  { value: '+54', label: '+54' },
  { value: '+56', label: '+56' },
  { value: '+44', label: '+44' },
];

export const ClinicAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isClinicAdmin, isTenantAdmin, isClinicDoctor, user } = useAuth();
  const { success, error } = useToast();

  const isSpanish = i18n.language?.startsWith('es');

  // RBAC standard:
  // Clinic Admin ONLY can create & update
  // Tenant Admin ONLY can delete
  const canAddOrUpdate = Boolean(isClinicAdmin);
  const canDelete = Boolean(isTenantAdmin);

  // Format helpers for actual times
  const formatTimeOnly = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDateOnly = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const calculateActualDuration = (startStr?: string | null, endStr?: string | null): number => {
    if (!startStr || !endStr) return 0;
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    if (isNaN(s) || isNaN(e)) return 0;
    return Math.max(0, Math.round((e - s) / 60000));
  };

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarSubMode, setCalendarSubMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Data & loading
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [calendarAppointments, setCalendarAppointments] = useState<AppointmentItem[]>([]);
  const [stats, setStats] = useState<AppointmentStats>({
    total: 0,
    todayTotal: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination & Filters
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');

  // Date Range Filter State (Defaults to ALL per user requirement)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: '',
    endDate: '',
    preset: 'all',
  });

  // Doctor & Patient Options for Selectors
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);

  const [viewingAppointment, setViewingAppointment] = useState<AppointmentItem | null>(null);
  const [deletingAppointment, setDeletingAppointment] = useState<AppointmentItem | null>(null);
  const [cancellingAppointment, setCancellingAppointment] = useState<AppointmentItem | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const initialFormState = {
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
  };
  interface SlotItem {
    startTime: string;
    endTime: string;
    available: boolean;
  }
  const [formData, setFormData] = useState(initialFormState);
  const [doctorServices, setDoctorServices] = useState<ClinicServiceItem[]>([]);
  const [loadingDoctorServices, setLoadingDoctorServices] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Quick Create Patient Modal State
  const [isQuickPatientModalOpen, setIsQuickPatientModalOpen] = useState<boolean>(false);
  const [quickPatientData, setQuickPatientData] = useState({
    firstName: '',
    fatherLastName: '',
    motherLastName: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    email: '',
    gender: '',
    notes: '',
  });
  const [quickPatientSubmitting, setQuickPatientSubmitting] = useState<boolean>(false);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/clinic/appointments/stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      // Non-blocking fallback
    }
  }, []);

  // Fetch Doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/clinic/appointments/working-hours/doctors');
      const docs = Array.isArray(res.data) ? res.data : (res.data?.doctors || []);
      setDoctors(docs);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  }, []);

  // Fetch Patients (for modal autocomplete)
  const fetchPatients = useCallback(async (query: string = '') => {
    try {
      const res = await api.get(`/clinic/patients?limit=50&search=${encodeURIComponent(query)}`);
      const list = res.data?.patients || [];
      setPatients(list);
    } catch (err) {
      console.error('Failed to load patients:', err);
    }
  }, []);

  // Searchable Select Options
  const patientOptions: SearchableSelectOption[] = useMemo(() => {
    return patients.map((p) => {
      const fullName = `${p.firstName} ${p.fatherLastName || ''}`.trim();
      const phone = p.phoneNumber ? ` • ${p.phoneNumber}` : '';
      return {
        value: p.id,
        label: fullName,
        sublabel: `Rec: ${p.recordNumber || 'N/A'}${phone}`,
      };
    });
  }, [patients]);

  const doctorFormOptions: SearchableSelectOption[] = useMemo(() => {
    return doctors.map((d) => ({
      value: d.id,
      label: `Dr. ${d.name}`,
      sublabel: d.roleName || (isSpanish ? 'Doctor de Clínica' : 'Clinic Doctor'),
    }));
  }, [doctors, isSpanish]);

  const doctorFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: isSpanish ? 'Todos los doctores' : 'All Doctors' },
      ...doctors.map((d) => ({
        value: d.id,
        label: `Dr. ${d.name}`,
        badge: d.colorCode || undefined,
      })),
    ];
  }, [doctors, isSpanish]);

  const statusFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: isSpanish ? 'Todos los estados' : 'All Statuses' },
      { value: 'SCHEDULED', label: isSpanish ? 'Programada' : 'Scheduled' },
      { value: 'IN_PROGRESS', label: isSpanish ? 'En Progreso' : 'In Progress' },
      { value: 'COMPLETED', label: isSpanish ? 'Completada' : 'Completed' },
      { value: 'CANCELLED', label: isSpanish ? 'Cancelada' : 'Cancelled' },
    ];
  }, [isSpanish]);

  const durationOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: '15', label: `15 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '30', label: `30 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '45', label: `45 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '60', label: `60 ${isSpanish ? 'minutos' : 'minutes'}` },
      { value: '90', label: `90 ${isSpanish ? 'minutos' : 'minutes'}` },
    ];
  }, [isSpanish]);

  const typeOptions: SearchableSelectOption[] = useMemo(() => {
    return APPOINTMENT_TYPES.map((t) => ({
      value: t.value,
      label: isSpanish ? t.labelEs : t.labelEn,
    }));
  }, [isSpanish]);

  // Fetch Appointments for Table List
  const fetchListAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (doctorFilter !== 'ALL') params.append('doctorId', doctorFilter);
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const res = await api.get(`/clinic/appointments?${params.toString()}`);
      setAppointments(res.data?.appointments || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalCount(res.data?.total || 0);
    } catch (err: any) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, doctorFilter, dateRange]);

  // Fetch Appointments for Calendar Range
  const fetchCalendarAppointments = useCallback(async () => {
    try {
      const curr = new Date(currentDate);
      let startDateStr = '';
      let endDateStr = '';

      if (calendarSubMode === 'day') {
        const dStr = curr.toISOString().split('T')[0];
        startDateStr = dStr;
        endDateStr = dStr;
      } else if (calendarSubMode === 'week') {
        const dayOfWeek = curr.getDay() === 0 ? 7 : curr.getDay(); // 1 = Mon
        const mon = new Date(curr);
        mon.setDate(curr.getDate() - (dayOfWeek - 1));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        startDateStr = mon.toISOString().split('T')[0];
        endDateStr = sun.toISOString().split('T')[0];
      } else {
        // Month
        const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1);
        const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
        startDateStr = firstDay.toISOString().split('T')[0];
        endDateStr = lastDay.toISOString().split('T')[0];
      }

      const params = new URLSearchParams();
      params.append('startDate', startDateStr);
      params.append('endDate', endDateStr);
      params.append('limit', '500');
      params.append('sortBy', 'date');
      params.append('sortOrder', 'asc');
      if (doctorFilter !== 'ALL') params.append('doctorId', doctorFilter);

      const res = await api.get(`/clinic/appointments?${params.toString()}`);
      setCalendarAppointments(res.data?.appointments || []);
    } catch (err) {
      console.error('Failed to load calendar appointments:', err);
    }
  }, [currentDate, calendarSubMode, doctorFilter]);

  useEffect(() => {
    fetchStats();
    fetchDoctors();
    fetchPatients();
  }, [fetchStats, fetchDoctors, fetchPatients]);

  const handleResetFilters = () => {
    setSearch('');
    setDoctorFilter('ALL');
    setStatusFilter('ALL');
    setDateRange({ startDate: '', endDate: '', preset: 'all' });
    setPage(1);
  };

  useEffect(() => {
    if (viewMode === 'list') {
      fetchListAppointments();
    } else {
      fetchCalendarAppointments();
    }
  }, [viewMode, fetchListAppointments, fetchCalendarAppointments]);

  // Fetch Available Slots when doctor/date/duration changes in form
  // Fetch Available Slots when doctor/date/duration changes in form
  const fetchAvailableSlots = useCallback(async (docId: string, dateStr: string, duration: number) => {
    if (!docId || !dateStr) {
      setAvailableSlots([]);
      return;
    }
    try {
      setLoadingSlots(true);
      const res = await api.get(
        `/clinic/appointments/working-hours/available-slots?doctorId=${docId}&date=${dateStr}&durationMinutes=${duration}`,
      );
      const raw = res.data?.slots || [];
      const parsedSlots: SlotItem[] = Array.isArray(raw)
        ? raw.map((s: any) =>
            typeof s === 'string'
              ? { startTime: s, endTime: calculateEndTimeString(s, duration), available: true }
              : { startTime: s.startTime, endTime: s.endTime, available: s.available !== false },
          )
        : [];
      setAvailableSlots(parsedSlots);
    } catch (err) {
      console.error('Failed to fetch available slots:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Calculate End Time String Helper
  const calculateEndTimeString = (start: string, durationMins: number = 30): string => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + (m || 0) + durationMins;
    const eh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const em = String(total % 60).padStart(2, '0');
    return `${eh}:${em}`;
  };

  const handleStartTimeChange = (newStart: string) => {
    let newEnd = formData.endTime;
    let dur = formData.durationMinutes || 30;
    if (newStart && (!newEnd || newEnd <= newStart)) {
      newEnd = calculateEndTimeString(newStart, 30);
      dur = 30;
    } else if (newStart && newEnd) {
      const [sh, sm] = newStart.split(':').map(Number);
      const [eh, em] = newEnd.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      dur = diff > 0 ? diff : 30;
    }
    setFormData((prev) => ({ ...prev, startTime: newStart, endTime: newEnd, durationMinutes: dur }));
  };

  const handleEndTimeChange = (newEnd: string) => {
    let dur = formData.durationMinutes || 30;
    if (formData.startTime && newEnd) {
      const [sh, sm] = formData.startTime.split(':').map(Number);
      const [eh, em] = newEnd.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      dur = diff > 0 ? diff : 30;
    }
    setFormData((prev) => ({ ...prev, endTime: newEnd, durationMinutes: dur }));
  };

  const handleSelectSlot = (slot: SlotItem) => {
    if (!slot.available) return;
    setFormData((prev) => ({
      ...prev,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  };

  // Handle duration change — re-fetch slots and recalculate endTime if a slot is selected
  const handleDurationChange = (newDuration: number) => {
    const dur = newDuration || 30;
    setFormData((prev) => {
      const updated = { ...prev, durationMinutes: dur };
      if (prev.startTime) {
        updated.endTime = calculateEndTimeString(prev.startTime, dur);
      }
      return updated;
    });
    if (formData.doctorId && formData.date) {
      fetchAvailableSlots(formData.doctorId, formData.date, dur);
    }
  };

  // Fetch services by doctor
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
      console.error('Failed to load services for doctor', err);
      setDoctorServices([]);
    } finally {
      setLoadingDoctorServices(false);
    }
  }, []);

  // Open Create Modal
  const openCreateModal = (prefillDate?: string, prefillTime?: string) => {
    if (!canAddOrUpdate) return;
    const dateVal = prefillDate && prefillDate >= getTodayString() ? prefillDate : getTodayString();
    setFormData({
      patientId: '',
      doctorId: '', // Doctor is NOT preselected
      date: dateVal,
      startTime: '',
      endTime: '',
      durationMinutes: 30,
      type: 'CONSULTATION',
      serviceIds: [],
      expectedAmount: 0,
      notes: '',
    });
    setDoctorServices([]);
    setAvailableSlots([]);
    setFormMode('create');
    setEditingId(null);
    setEditingAppointment(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (apt: AppointmentItem) => {
    if (!canAddOrUpdate) return;
    const dStr = apt.date ? apt.date.substring(0, 10) : getTodayString();
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
    } else {
      setDoctorServices([]);
    }
    setFormMode('edit');
    setEditingId(apt.id);
    setEditingAppointment(apt);
    setIsFormModalOpen(true);
    // Only fetch slots if appointment has not started yet
    if (apt.doctorId && dStr && apt.status === 'SCHEDULED') {
      fetchAvailableSlots(apt.doctorId, dStr, apt.durationMinutes || 30);
    }
  };

  // Check if current editing appointment has already started (locking time slot)
  const isSlotLocked = Boolean(
    formMode === 'edit' &&
      editingAppointment &&
      (editingAppointment.status === 'IN_PROGRESS' || editingAppointment.status === 'COMPLETED'),
  );

  // Quick Create Patient Submit
  const handleQuickPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPatientData.firstName.trim()) {
      error(isSpanish ? 'El nombre es obligatorio' : 'First name is required');
      return;
    }
    try {
      setQuickPatientSubmitting(true);
      const res = await api.post('/clinic/patients', {
        firstName: quickPatientData.firstName.trim(),
        fatherLastName: quickPatientData.fatherLastName.trim() || undefined,
        motherLastName: quickPatientData.motherLastName.trim() || undefined,
        phoneCountryCode: quickPatientData.phoneCountryCode || '+52',
        phoneNumber: quickPatientData.phoneNumber.trim() || undefined,
        email: quickPatientData.email.trim() || undefined,
        gender: quickPatientData.gender || undefined,
        notes: quickPatientData.notes.trim() || undefined,
      });
      const newPatient = res.data;
      if (newPatient && newPatient.id) {
        setPatients((prev) => [newPatient, ...prev]);
        setFormData((prev) => ({ ...prev, patientId: newPatient.id }));
        success(isSpanish ? 'Paciente registrado y seleccionado exitosamente' : 'Patient created and selected successfully');
        setIsQuickPatientModalOpen(false);
        setQuickPatientData({
          firstName: '',
          fatherLastName: '',
          motherLastName: '',
          phoneCountryCode: '+52',
          phoneNumber: '',
          email: '',
          gender: '',
          notes: '',
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error creating patient';
      error(msg);
    } finally {
      setQuickPatientSubmitting(false);
    }
  };

  // Submit Add / Edit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddOrUpdate) return;
    if (!formData.patientId) {
      error(isSpanish ? 'Por favor selecciona un paciente' : 'Please select a patient');
      return;
    }
    if (!formData.doctorId) {
      error(isSpanish ? 'Por favor selecciona un doctor' : 'Please select a doctor');
      return;
    }
    if (formData.date < getTodayString()) {
      error(isSpanish ? 'No se permiten citas en fechas pasadas' : 'Appointments cannot be scheduled on past dates');
      return;
    }
    if (!formData.startTime) {
      error(isSpanish ? 'Por favor ingresa la hora de inicio' : 'Please select a start time');
      return;
    }
    if (!formData.endTime) {
      error(isSpanish ? 'Por favor ingresa la hora de fin' : 'Please select an end time');
      return;
    }
    if (formData.endTime <= formData.startTime) {
      error(isSpanish ? 'La hora de fin debe ser posterior a la de inicio' : 'End time must be after start time');
      return;
    }
    if (!formData.serviceIds || formData.serviceIds.length === 0) {
      error(isSpanish ? 'Por favor selecciona al menos un servicio' : 'Please select at least one service');
      return;
    }

    try {
      setIsSubmitting(true);
      if (formMode === 'create') {
        await api.post('/clinic/appointments', formData);
        success(isSpanish ? 'Cita programada exitosamente' : 'Appointment scheduled successfully');
      } else if (editingId) {
        // If slot is locked, omit date/time attributes from update payload
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
        await api.patch(`/clinic/appointments/${editingId}`, payload);
        success(isSpanish ? 'Cita actualizada exitosamente' : 'Appointment updated successfully');
      }
      setIsFormModalOpen(false);
      fetchStats();
      if (viewMode === 'list') {
        fetchListAppointments();
      } else {
        fetchCalendarAppointments();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error saving appointment';
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status Quick Action (Clinic Admin only)
  const handleStatusChange = async (appointmentId: string, newStatus: string, cancellationReason?: string) => {
    if (!canAddOrUpdate) return;
    try {
      const payload: any = { status: newStatus };
      if (newStatus === 'CANCELLED' && cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }
      const res = await api.patch(`/clinic/appointments/${appointmentId}/status`, payload);
      const msg =
        newStatus === 'IN_PROGRESS'
          ? (isSpanish ? 'Cita iniciada exitosamente' : 'Appointment started successfully')
          : newStatus === 'COMPLETED'
          ? (isSpanish ? 'Cita finalizada exitosamente' : 'Appointment completed successfully')
          : newStatus === 'CANCELLED'
          ? (isSpanish ? 'Cita cancelada' : 'Appointment cancelled')
          : (isSpanish ? 'Estado actualizado' : 'Status updated');
      success(msg);
      fetchStats();
      if (viewMode === 'list') {
        fetchListAppointments();
      } else {
        fetchCalendarAppointments();
      }
      if (viewingAppointment?.id === appointmentId) {
        setViewingAppointment((prev) => (prev ? { ...prev, ...(res.data || {}), status: newStatus as any } : null));
      }
      // If appointment was started, auto-redirect to dedicated Income page
      if (newStatus === 'IN_PROGRESS') {
        navigate(`/clinic/appointments/${appointmentId}/income`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update status';
      error(msg);
    }
  };

  const handlePromptCancel = (apt: AppointmentItem) => {
    setCancellingAppointment(apt);
    setCancellationReasonInput('');
  };

  // Delete Appointment (Tenant Admin ONLY)
  const handleDeleteAppointment = async () => {
    if (!canDelete || !deletingAppointment) return;
    try {
      setIsDeleting(true);
      await api.delete(`/clinic/appointments/${deletingAppointment.id}`);
      success(isSpanish ? 'Cita eliminada permanentemente' : 'Appointment deleted successfully');
      setDeletingAppointment(null);
      setViewingAppointment(null);
      fetchStats();
      if (viewMode === 'list') {
        fetchListAppointments();
      } else {
        fetchCalendarAppointments();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete appointment';
      error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Calendar Navigation
  const handlePrevDate = () => {
    const next = new Date(currentDate);
    if (calendarSubMode === 'day') next.setDate(next.getDate() - 1);
    else if (calendarSubMode === 'week') next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    if (calendarSubMode === 'day') next.setDate(next.getDate() + 1);
    else if (calendarSubMode === 'week') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleTodayDate = () => {
    setCurrentDate(new Date());
  };

  // Helper date formatter for Calendar header
  const getCalendarHeaderLabel = () => {
    const curr = currentDate;
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mNames = isSpanish ? monthNamesEs : monthNamesEn;

    if (calendarSubMode === 'day') {
      const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const daysEs = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dName = (isSpanish ? daysEs : daysEn)[curr.getDay()];
      return `${dName}, ${curr.getDate()} ${mNames[curr.getMonth()]} ${curr.getFullYear()}`;
    }

    if (calendarSubMode === 'week') {
      const dayOfWeek = curr.getDay() === 0 ? 7 : curr.getDay();
      const mon = new Date(curr);
      mon.setDate(curr.getDate() - (dayOfWeek - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${mon.getDate()} ${mNames[mon.getMonth()]} — ${sun.getDate()} ${mNames[sun.getMonth()]} ${sun.getFullYear()}`;
    }

    return `${mNames[curr.getMonth()]} ${curr.getFullYear()}`;
  };

  // Days array for Week View
  const weekDays = useMemo(() => {
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
    const mon = new Date(currentDate);
    mon.setDate(currentDate.getDate() - (dayOfWeek - 1));

    const days = [];
    const daysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysEs = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const isToday = dStr === getTodayString();
      days.push({
        date: d,
        dateString: dStr,
        dayName: isSpanish ? daysEs[i] : daysEn[i],
        dayNum: d.getDate(),
        isToday,
      });
    }
    return days;
  }, [currentDate, isSpanish]);

  // Hours array for Day & Week view timeline (08:00 to 19:00)
  const timelineHours = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
  ];

  return (
    <div className="clinic-appointments-page" style={{ padding: '4px 0 32px' }}>
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
              <CalendarCheck size={20} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
              {isSpanish ? 'Citas de Clínica' : 'Appointments'}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {isSpanish
              ? 'Gestión de agenda médica, citas de pacientes y vistas interactivas de calendario.'
              : 'Manage clinic schedule, patient appointments, and interactive calendar views.'}
          </p>
        </div>

        {/* Action Controls & Mode Switch */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Mode Switch: List vs Calendar */}
          <div
            style={{
              display: 'flex',
              padding: '3px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'list' ? 'var(--primary-600)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                fontWeight: viewMode === 'list' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isSpanish ? 'Lista' : 'List'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'calendar' ? 'var(--primary-600)' : 'transparent',
                color: viewMode === 'calendar' ? '#fff' : 'var(--text-muted)',
                fontWeight: viewMode === 'calendar' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isSpanish ? 'Calendario' : 'Calendar'}
            </button>
          </div>

          {/* Add Appointment Button: STRICTLY Clinic Admin ONLY */}
          {canAddOrUpdate && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>{isSpanish ? 'Nueva Cita' : 'Add Appointment'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards (Total Appointments, Scheduled, In Progress, Completed, Cancelled) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            {isSpanish ? 'Total de Citas' : 'Total Appointments'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
            {stats.total ?? stats.todayTotal ?? 0}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 500 }}>
            {isSpanish ? 'Programadas' : 'Scheduled'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
            {stats.scheduled}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 500 }}>
            {isSpanish ? 'En Progreso' : 'In Progress'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
            {stats.inProgress || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 500 }}>
            {isSpanish ? 'Completadas' : 'Completed'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#4f46e5', marginTop: '4px' }}>
            {stats.completed}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
            {isSpanish ? 'Canceladas' : 'Cancelled'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
            {stats.cancelled}
          </div>
        </div>
      </div>

      {/* Filter & Calendar Controls Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        {/* Left side: Search & Dropdowns */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1 }}>
          {viewMode === 'list' && (
            <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  display: 'flex',
                }}
              >
                <Search size={16} />
              </span>
              <input
                type="text"
                className="input"
                placeholder={isSpanish ? 'Buscar por # cita, paciente o doctor...' : 'Search by # apt, patient, doctor...'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '40px',
                  paddingLeft: '38px',
                  fontSize: '13px',
                }}
              />
            </div>
          )}

          {/* Doctor Filter (SearchableSelect) */}
          <div style={{ minWidth: '200px' }}>
            <SearchableSelect
              options={doctorFilterOptions}
              value={doctorFilter}
              onChange={(val) => {
                setDoctorFilter(val);
                setPage(1);
              }}
              placeholder={isSpanish ? 'Filtrar por doctor...' : 'Filter doctor...'}
              searchPlaceholder={isSpanish ? 'Buscar doctor...' : 'Search doctor...'}
              icon={<User size={14} />}
            />
          </div>

          {/* Status Filter (SearchableSelect) */}
          {viewMode === 'list' && (
            <div style={{ minWidth: '180px' }}>
              <SearchableSelect
                options={statusFilterOptions}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                placeholder={isSpanish ? 'Filtrar por estado...' : 'Filter status...'}
                searchPlaceholder={isSpanish ? 'Buscar estado...' : 'Search status...'}
                icon={<Filter size={14} />}
              />
            </div>
          )}

          {/* Date Range Filter */}
          {viewMode === 'list' && (
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => {
                setDateRange(newRange);
                setPage(1);
              }}
            />
          )}

          {/* Reset Filters Option (after Date Range) */}
          {viewMode === 'list' && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{
                height: '40px',
                padding: '0 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-body)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title={isSpanish ? 'Restablecer todos los filtros' : 'Reset all filters'}
            >
              <RotateCcw size={14} />
              <span>{isSpanish ? 'Restablecer' : 'Reset'}</span>
            </button>
          )}
        </div>

        {/* Right side: Calendar Navigation & SubMode Switch */}
        {viewMode === 'calendar' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            {/* Day / Week / Month Switch */}
            <div
              style={{
                display: 'flex',
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
              }}
            >
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarSubMode(mode)}
                  style={{
                    padding: '5px 12px',
                    border: 'none',
                    backgroundColor: calendarSubMode === mode ? 'var(--primary-600)' : 'var(--bg-input)',
                    color: calendarSubMode === mode ? '#fff' : 'var(--text-muted)',
                    fontSize: '12.5px',
                    fontWeight: calendarSubMode === mode ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'day' ? (isSpanish ? 'Día' : 'Day') : mode === 'week' ? (isSpanish ? 'Semana' : 'Week') : (isSpanish ? 'Mes' : 'Month')}
                </button>
              ))}
            </div>

            {/* Date Nav Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handlePrevDate}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                title={isSpanish ? 'Anterior' : 'Previous'}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={handleTodayDate}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                {isSpanish ? 'Hoy' : 'Today'}
              </button>

              <button
                type="button"
                onClick={handleNextDate}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                title={isSpanish ? 'Siguiente' : 'Next'}
              >
                <ChevronRight size={16} />
              </button>

              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--text-heading)',
                  marginLeft: '6px',
                  minWidth: '150px',
                }}
              >
                {getCalendarHeaderLabel()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: LIST VIEW TABLE */}
      {viewMode === 'list' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isSpanish ? 'Cargando citas...' : 'Loading appointments...'}
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <CalendarCheck size={40} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 6px' }}>
                {isSpanish ? 'No se encontraron citas' : 'No appointments found'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {isSpanish
                  ? 'Intenta cambiar los filtros de búsqueda o programa una nueva cita.'
                  : 'Try modifying your search filters or schedule a new appointment.'}
              </p>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(148, 163, 184, 0.05)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Paciente' : 'Patient'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Doctor' : 'Doctor'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('appointments.scheduledDateTime', isSpanish ? 'Fecha y Hora Programada' : 'Scheduled Date & Time')}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('appointments.actualStartEndTime', isSpanish ? 'Hora de Inicio y Fin Real' : 'Actual Start & End Time')}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Estado' : 'Status'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Acción Clínica' : 'Clinical Action'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Acciones' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => {
                    const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED;
                    const dateFormatted = apt.date ? apt.date.substring(0, 10) : '';

                    return (
                      <tr
                        key={apt.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.1s ease',
                        }}
                      >
                        {/* Patient info */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                              {apt.patient?.firstName} {apt.patient?.fatherLastName || ''}
                            </div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--primary-600)',
                                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {apt.appointmentNumber}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span>Rec: {apt.patient?.recordNumber || 'N/A'}</span>
                            {apt.patient?.phoneNumber && (
                              <span>• {apt.patient?.phoneCountryCode || '+52'} {apt.patient?.phoneNumber}</span>
                            )}
                          </div>
                        </td>

                        {/* Doctor info */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-body)' }}>
                          Dr. {apt.doctor?.name || 'Assigned Doctor'}
                        </td>

                        {/* Scheduled Date & Time */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-heading)' }}>
                            {dateFormatted}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            <span>
                              {apt.startTime} - {apt.endTime} ({apt.durationMinutes}m)
                            </span>
                          </div>
                        </td>

                        {/* Actual Start & End Time */}
                        <td style={{ padding: '14px 16px' }}>
                          {apt.actualStartTime && apt.actualEndTime ? (
                            <>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-heading)' }}>
                                {formatDateOnly(apt.actualStartTime)}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                <span>
                                  {formatTimeOnly(apt.actualStartTime)} - {formatTimeOnly(apt.actualEndTime)} ({calculateActualDuration(apt.actualStartTime, apt.actualEndTime)}m)
                                </span>
                              </div>
                              {(apt.startedBy?.name || apt.endedBy?.name) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.2' }}>
                                  {apt.startedBy?.name && apt.endedBy?.name && apt.startedBy.name === apt.endedBy.name ? (
                                    <span>{t('appointments.by', isSpanish ? 'Por' : 'By')}: {apt.startedBy.name}</span>
                                  ) : (
                                    <span>
                                      {apt.startedBy?.name && <span>{t('appointments.startedBy', isSpanish ? 'Inicio' : 'Start')}: {apt.startedBy.name}</span>}
                                      {apt.startedBy?.name && apt.endedBy?.name && ' • '}
                                      {apt.endedBy?.name && <span>{t('appointments.endedBy', isSpanish ? 'Fin' : 'End')}: {apt.endedBy.name}</span>}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          ) : apt.actualStartTime ? (
                            <>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-heading)' }}>
                                {formatDateOnly(apt.actualStartTime)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <Clock size={12} />
                                <span>
                                  {formatTimeOnly(apt.actualStartTime)} - {t('appointments.inProgress', isSpanish ? 'En curso' : 'In Progress')}
                                </span>
                              </div>
                              {apt.startedBy?.name && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.2' }}>
                                  <span>{t('appointments.startedBy', isSpanish ? 'Iniciada por' : 'Started by')}: {apt.startedBy.name}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              backgroundColor: st.bg,
                              color: st.color,
                              border: `1px solid ${st.border}`,
                              fontWeight: 600,
                              display: 'inline-block',
                            }}
                          >
                            {isSpanish ? st.labelEs : st.labelEn}
                          </span>
                        </td>

                        {/* Clinical Action */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {canAddOrUpdate && apt.status === 'SCHEDULED' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(apt.id, 'IN_PROGRESS')}
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#047857',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title={isSpanish ? 'Iniciar cita' : 'Start appointment'}
                              >
                                <Play size={12} fill="#047857" />
                                <span>{isSpanish ? 'Iniciar' : 'Start'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptCancel(apt)}
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  fontWeight: 500,
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: '#dc2626',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title={isSpanish ? 'Cancelar cita' : 'Cancel appointment'}
                              >
                                <XCircle size={12} />
                                <span>{isSpanish ? 'Cancelar' : 'Cancel'}</span>
                              </button>
                            </div>
                          )}

                          {canAddOrUpdate && apt.status === 'IN_PROGRESS' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: '#4f46e5',
                                  color: '#ffffff',
                                  border: '1px solid #4f46e5',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                                title={isSpanish ? 'Finalizar cita' : 'End appointment'}
                              >
                                <CheckCircle2 size={12} />
                                <span>{isSpanish ? 'Finalizar' : 'End'}</span>
                              </button>
                            </div>
                          )}

                          {apt.status === 'COMPLETED' && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>—</span>
                          )}

                          {apt.status === 'CANCELLED' && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Income Page (non-cancelled appointments) */}
                            {canAddOrUpdate && apt.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => navigate(`/clinic/appointments/${apt.id}/income`)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: '5px 8px',
                                  color: '#059669',
                                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                  borderColor: 'rgba(16, 185, 129, 0.25)',
                                }}
                                title={isSpanish ? 'Ingresos y Facturación' : 'Income & Billing'}
                              >
                                <DollarSign size={14} />
                              </button>
                            )}

                            {/* View Details (All roles) */}
                            <button
                              type="button"
                              onClick={() => setViewingAppointment(apt)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 8px' }}
                              title={isSpanish ? 'Ver detalles' : 'View details'}
                            >
                              <Eye size={14} />
                            </button>

                            {/* Edit (Clinic Admin ONLY) */}
                            {canAddOrUpdate && (
                              <button
                                type="button"
                                onClick={() => openEditModal(apt)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 8px' }}
                                title={isSpanish ? 'Editar cita' : 'Edit appointment'}
                              >
                                <Edit2 size={14} />
                              </button>
                            )}

                            {/* Delete (Tenant Admin ONLY - hidden for Clinic Admin) */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeletingAppointment(apt)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '5px 8px' }}
                                title={isSpanish ? 'Eliminar cita' : 'Delete appointment'}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalCount > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={limit}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(sz) => {
                setLimit(sz);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* VIEW MODE 2: INTERACTIVE CALENDAR */}
      {viewMode === 'calendar' && (
        <div className="card" style={{ padding: '18px', overflowX: 'auto' }}>
          {/* Doctor Color Legend in Calendar View */}
          {doctors.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                {isSpanish ? 'Doctores de Clínica:' : 'Attending Doctors:'}
              </span>
              {doctors.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-heading)',
                  }}
                >
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      backgroundColor: d.colorCode || '#0EA5E9',
                      flexShrink: 0,
                    }}
                  />
                  <span>Dr. {d.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Week View */}
          {calendarSubMode === 'week' && (
            <div style={{ minWidth: '760px' }}>
              {/* Day Headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px repeat(7, 1fr)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '8px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{isSpanish ? 'HORA' : 'TIME'}</div>
                {weekDays.map((wd) => (
                  <div
                    key={wd.dateString}
                    style={{
                      textAlign: 'center',
                      padding: '4px',
                      borderRadius: '6px',
                      backgroundColor: wd.isToday ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>{wd.dayName}</div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: wd.isToday ? 'var(--primary-600)' : 'var(--text-heading)',
                      }}
                    >
                      {wd.dayNum}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hourly Grid Rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px repeat(7, 1fr)',
                      minHeight: '62px',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                    }}
                  >
                    {/* Hour label */}
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        paddingTop: '6px',
                        fontWeight: 500,
                      }}
                    >
                      {hour}
                    </div>

                    {/* 7 Day Columns */}
                    {weekDays.map((wd) => {
                      // Filter appointments matching this day and starting with this hour
                      const hourPrefix = hour.substring(0, 2);
                      const matchingApts = calendarAppointments.filter((apt) => {
                        const aptDate = apt.date ? apt.date.substring(0, 10) : '';
                        return aptDate === wd.dateString && apt.startTime.startsWith(hourPrefix);
                      });

                      const isLunch = hour === '13:00';

                      return (
                        <div
                          key={wd.dateString}
                          onClick={() => {
                            if (canAddOrUpdate && matchingApts.length === 0) {
                              openCreateModal(wd.dateString, hour);
                            }
                          }}
                          style={{
                            borderLeft: '1px solid rgba(148, 163, 184, 0.12)',
                            padding: '3px',
                            backgroundColor: isLunch ? 'rgba(148, 163, 184, 0.05)' : 'transparent',
                            cursor: canAddOrUpdate && matchingApts.length === 0 ? 'pointer' : 'default',
                            position: 'relative',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          {isLunch && matchingApts.length === 0 && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                paddingTop: '4px',
                                opacity: 0.6,
                              }}
                            >
                              <Coffee size={10} style={{ display: 'inline', marginRight: '2px' }} />
                              {isSpanish ? 'Almuerzo' : 'Lunch'}
                            </div>
                          )}

                          {matchingApts.map((apt) => {
                            const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED;
                            const docColor = apt.doctor?.colorCode || st.color;
                            return (
                              <div
                                key={apt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingAppointment(apt);
                                }}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '5px',
                                  backgroundColor: st.bg,
                                  borderLeft: `4px solid ${docColor}`,
                                  borderTop: `1px solid ${st.border}`,
                                  borderRight: `1px solid ${st.border}`,
                                  borderBottom: `1px solid ${st.border}`,
                                  fontSize: '11px',
                                  marginBottom: '3px',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                }}
                              >
                                <div style={{ fontWeight: 600, color: st.color, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {apt.startTime} {apt.patient?.firstName}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: docColor, display: 'inline-block', flexShrink: 0 }} />
                                  <span>Dr. {apt.doctor?.name?.split(' ')[0]}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day View */}
          {calendarSubMode === 'day' && (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {timelineHours.map((hour) => {
                  const hourPrefix = hour.substring(0, 2);
                  const currStr = currentDate.toISOString().split('T')[0];
                  const matchingApts = calendarAppointments.filter((apt) => {
                    const aptDate = apt.date ? apt.date.substring(0, 10) : '';
                    return aptDate === currStr && apt.startTime.startsWith(hourPrefix);
                  });
                  const isLunch = hour === '13:00';

                  return (
                    <div
                      key={hour}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: '10px',
                        minHeight: '60px',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', paddingTop: '4px' }}>
                        {hour}
                      </div>

                      <div
                        onClick={() => {
                          if (canAddOrUpdate && matchingApts.length === 0) {
                            openCreateModal(currStr, hour);
                          }
                        }}
                        style={{
                          backgroundColor: isLunch ? 'rgba(148, 163, 184, 0.06)' : 'rgba(56, 189, 248, 0.02)',
                          borderRadius: '8px',
                          border: '1px dashed var(--border-color)',
                          padding: '6px 12px',
                          cursor: canAddOrUpdate && matchingApts.length === 0 ? 'pointer' : 'default',
                        }}
                      >
                        {matchingApts.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: '4px' }}>
                            {isLunch
                              ? (isSpanish ? '☕ Pausa de Almuerzo' : '☕ Lunch Break')
                              : canAddOrUpdate
                              ? (isSpanish ? '+ Clic para agendar cita' : '+ Click slot to schedule')
                              : (isSpanish ? 'Disponible' : 'Available')}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {matchingApts.map((apt) => {
                              const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED;
                              const docColor = apt.doctor?.colorCode || st.color;
                              return (
                                <div
                                  key={apt.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingAppointment(apt);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: st.bg,
                                    borderLeft: `4px solid ${docColor}`,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-heading)' }}>
                                      {apt.patient?.firstName} {apt.patient?.fatherLastName || ''}
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '12px',
                                        color: 'var(--text-heading)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: `${docColor}18`,
                                        border: `1px solid ${docColor}35`,
                                      }}
                                    >
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: docColor }} />
                                      <span>Dr. {apt.doctor?.name}</span>
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: st.color }}>
                                      {apt.startTime} - {apt.endTime}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '2px 6px',
                                        borderRadius: '8px',
                                        backgroundColor: st.color,
                                        color: '#fff',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {isSpanish ? st.labelEs : st.labelEn}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month View */}
          {calendarSubMode === 'month' && (
            <div>
              {/* 7 Days Names */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <div>{isSpanish ? 'Lunes' : 'Monday'}</div>
                <div>{isSpanish ? 'Martes' : 'Tuesday'}</div>
                <div>{isSpanish ? 'Miércoles' : 'Wednesday'}</div>
                <div>{isSpanish ? 'Jueves' : 'Thursday'}</div>
                <div>{isSpanish ? 'Viernes' : 'Friday'}</div>
                <div>{isSpanish ? 'Sábado' : 'Saturday'}</div>
                <div>{isSpanish ? 'Domingo' : 'Sunday'}</div>
              </div>

              {/* 35/42 Days Matrix */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  borderLeft: '1px solid var(--border-color)',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                {Array.from({ length: 35 }).map((_, idx) => {
                  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  const startingDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // 0 = Mon
                  const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), idx - startingDay + 1);
                  const isCurrentMonth = dayDate.getMonth() === currentDate.getMonth();
                  const dStr = dayDate.toISOString().split('T')[0];
                  const isToday = dStr === getTodayString();

                  const dayApts = calendarAppointments.filter((apt) => {
                    const aptDate = apt.date ? apt.date.substring(0, 10) : '';
                    return aptDate === dStr;
                  });

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (canAddOrUpdate) {
                          openCreateModal(dStr, '09:00');
                        }
                      }}
                      style={{
                        minHeight: '90px',
                        padding: '6px',
                        borderRight: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isToday
                          ? 'rgba(56, 189, 248, 0.08)'
                          : isCurrentMonth
                          ? 'transparent'
                          : 'rgba(148, 163, 184, 0.04)',
                        opacity: isCurrentMonth ? 1 : 0.45,
                        cursor: canAddOrUpdate ? 'pointer' : 'default',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? 'var(--primary-600)' : 'var(--text-heading)',
                          textAlign: 'right',
                        }}
                      >
                        {dayDate.getDate()}
                      </div>

                      {dayApts.slice(0, 3).map((apt) => {
                        const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED;
                        const docColor = apt.doctor?.colorCode || st.color;
                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingAppointment(apt);
                            }}
                            style={{
                              fontSize: '10px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              backgroundColor: st.bg,
                              borderLeft: `2px solid ${docColor}`,
                              color: st.color,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: docColor, flexShrink: 0 }} />
                            <span>{apt.startTime} {apt.patient?.firstName}</span>
                          </div>
                        );
                      })}

                      {dayApts.length > 3 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          +{dayApts.length - 3} {isSpanish ? 'más' : 'more'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT APPOINTMENT (Clinic Admin ONLY) */}
      {isFormModalOpen && canAddOrUpdate && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={18} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  {formMode === 'create'
                    ? (isSpanish ? 'Nueva Cita Médica' : 'Schedule New Appointment')
                    : (isSpanish ? 'Editar Cita' : 'Edit Appointment')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto', padding: '16px 20px' }}>
                {/* Patient Selector (SearchableSelect) + New Patient Button */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                      {isSpanish ? 'Paciente *' : 'Patient *'}
                    </label>
                    {canAddOrUpdate && (
                      <button
                        type="button"
                        onClick={() => setIsQuickPatientModalOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--primary-600)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        <Plus size={13} />
                        <span>{isSpanish ? 'Nuevo Paciente' : 'New Patient'}</span>
                      </button>
                    )}
                  </div>
                  <SearchableSelect
                    options={patientOptions}
                    value={formData.patientId}
                    onChange={(val) => setFormData({ ...formData, patientId: val })}
                    placeholder={isSpanish ? '-- Selecciona un paciente --' : '-- Select Patient --'}
                    searchPlaceholder={isSpanish ? 'Buscar por nombre o expediente...' : 'Search by patient name or record #...'}
                    icon={<User size={14} />}
                  />
                </div>

                {/* Doctor Selector (SearchableSelect) - Not preselected */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Doctor *' : 'Doctor *'}
                  </label>
                  <SearchableSelect
                    options={doctorFormOptions}
                    value={formData.doctorId}
                    onChange={(val) => {
                      setFormData({
                        ...formData,
                        doctorId: val,
                        startTime: '',
                        endTime: '',
                        serviceIds: [],
                        expectedAmount: 0,
                      });
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
                    placeholder={isSpanish ? '-- Selecciona un doctor --' : '-- Select Doctor --'}
                    searchPlaceholder={isSpanish ? 'Buscar doctor...' : 'Search doctor...'}
                    icon={<UserRound size={14} />}
                  />
                </div>

                {/* Date Input & Lock Notice */}
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
                      fontWeight: 500,
                      marginBottom: '14px',
                    }}
                  >
                    <Lock size={16} style={{ flexShrink: 0, color: '#d97706' }} />
                    <span>
                      {isSpanish
                        ? 'Esta cita ya ha comenzado. La fecha y el horario están bloqueados y no se pueden modificar.'
                        : 'This appointment has already started. The date and time slot are locked and cannot be changed.'}
                    </span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Fecha *' : 'Date *'}
                    {isSlotLocked && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: '#b45309', fontWeight: 500 }}>
                        ({isSpanish ? 'Bloqueada' : 'Locked'})
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    className="input"
                    min={getTodayString()}
                    value={formData.date}
                    disabled={isSlotLocked}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      if (newDate && newDate < getTodayString()) {
                        return;
                      }
                      setFormData({ ...formData, date: newDate, startTime: '', endTime: '' });
                      if (formData.doctorId && newDate) {
                        fetchAvailableSlots(formData.doctorId, newDate, formData.durationMinutes || 30);
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      cursor: isSlotLocked ? 'not-allowed' : 'auto',
                      opacity: isSlotLocked ? 0.75 : 1,
                    }}
                  />
                </div>

                {/* Services Multi-Select — Placed immediately after Date field */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                      {isSpanish ? 'Servicios *' : 'Services *'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {isSpanish ? 'Total Estimado:' : 'Total Amount:'}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
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
                  </div>

                  {!formData.doctorId ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px dashed var(--border-color)',
                        color: 'var(--text-muted)',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Info size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                      <span>{isSpanish ? 'Selecciona un doctor para cargar los servicios disponibles.' : 'Select a doctor to view available services.'}</span>
                    </div>
                  ) : loadingDoctorServices ? (
                    <div style={{ padding: '10px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {isSpanish ? 'Cargando servicios...' : 'Loading services...'}
                    </div>
                  ) : doctorServices.length === 0 ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#b45309',
                        fontSize: '12.5px',
                      }}
                    >
                      {isSpanish ? 'No hay servicios activos registrados para este doctor o clínica.' : 'No active services found for this doctor or clinic.'}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input, #ffffff)',
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
                        const priceNum = Number(svc.price);
                        return (
                          <label
                            key={svc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                              border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const newIds = checked
                                    ? [...formData.serviceIds, svc.id]
                                    : formData.serviceIds.filter((id) => id !== svc.id);

                                  // Recalculate total
                                  const newTotal = doctorServices
                                    .filter((s) => newIds.includes(s.id))
                                    .reduce((acc, s) => acc + Number(s.price), 0);

                                  setFormData({
                                    ...formData,
                                    serviceIds: newIds,
                                    expectedAmount: newTotal,
                                  });
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary-600, #4f46e5)' }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: 'var(--text-heading)' }}>
                                {svc.name}
                              </span>
                            </div>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: isSelected ? '#059669' : 'var(--text-muted)' }}>
                              ${priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Duration Selector */}
                {!isSlotLocked && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Duración de la Cita *' : 'Appointment Duration *'}
                    </label>
                    <SearchableSelect
                      options={durationOptions}
                      value={String(formData.durationMinutes || 30)}
                      onChange={(val) => handleDurationChange(Number(val))}
                      placeholder={isSpanish ? 'Seleccionar duración...' : 'Select duration...'}
                      icon={<Clock size={14} />}
                    />
                  </div>
                )}

                {/* Start Time & End Time Row (Read-Only — auto-populated from slot selection) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Hora de Inicio *' : 'Start Time *'}
                      {!isSlotLocked && (
                        <span style={{ marginLeft: '6px', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                          ({isSpanish ? 'Auto' : 'Auto'})
                        </span>
                      )}
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={formData.startTime}
                      readOnly
                      tabIndex={-1}
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '8px 10px',
                        fontSize: '13px',
                        cursor: 'default',
                        backgroundColor: 'var(--bg-secondary)',
                        opacity: isSlotLocked ? 0.75 : 0.9,
                        pointerEvents: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Hora de Fin *' : 'End Time *'}
                      {!isSlotLocked && (
                        <span style={{ marginLeft: '6px', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                          ({isSpanish ? 'Auto' : 'Auto'})
                        </span>
                      )}
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={formData.endTime}
                      readOnly
                      tabIndex={-1}
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '8px 10px',
                        fontSize: '13px',
                        cursor: 'default',
                        backgroundColor: 'var(--bg-secondary)',
                        opacity: isSlotLocked ? 0.75 : 0.9,
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Available Slots Picker (or Locked badge if already started) */}
                {isSlotLocked ? (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>
                      <Lock size={15} style={{ color: '#d97706' }} />
                      <span>{isSpanish ? 'Horario de Cita Asignado (En Curso)' : 'Assigned Active Slot'}</span>
                    </label>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          {formData.startTime} – {formData.endTime} ({formData.durationMinutes} min)
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#b45309',
                          fontWeight: 600,
                        }}
                      >
                        {isSpanish ? 'Fijo / No modificable' : 'Fixed / Non-editable'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#047857', margin: 0 }}>
                        <Clock size={15} style={{ color: '#059669' }} />
                        <span>{isSpanish ? `Horarios Disponibles (${formData.durationMinutes} min)` : `Available Slots (${formData.durationMinutes} min)`}</span>
                        {availableSlots.length > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '1px 8px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#047857',
                            }}
                          >
                            {availableSlots.filter((s) => s.available).length} {isSpanish ? 'libres' : 'free'}
                          </span>
                        )}
                      </label>

                      {/* Booked Indicator Badge */}
                      {availableSlots.some((s) => !s.available) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                          <span>{isSpanish ? 'Ocupado' : 'Booked'}</span>
                        </div>
                      )}
                    </div>

                  {!formData.doctorId ? (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-muted)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Info size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                      <span>
                        {isSpanish
                          ? 'Selecciona un doctor para consultar los horarios disponibles.'
                          : 'Please select a doctor to view available time slots.'}
                      </span>
                    </div>
                  ) : loadingSlots ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                      {isSpanish ? 'Calculando horarios...' : 'Checking availability...'}
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--amber-500)',
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                      }}
                    >
                      {isSpanish
                        ? 'No hay horarios disponibles en esta fecha o el doctor no labora hoy.'
                        : 'No available slots for this doctor on the selected date.'}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
                        gap: '8px',
                        maxHeight: '190px',
                        overflowY: 'auto',
                        padding: '4px',
                      }}
                    >
                      {availableSlots.map((slot) => {
                        const isSelected = formData.startTime === slot.startTime;
                        const isBooked = !slot.available;
                        const label = `${slot.startTime}–${slot.endTime}`;

                        if (isBooked) {
                          return (
                            <div
                              key={slot.startTime}
                              title={isSpanish ? 'Horario ya ocupado' : 'Slot already booked'}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                padding: '8px 12px',
                                borderRadius: '9999px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(239, 68, 68, 0.04)',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 500,
                                opacity: 0.45,
                                cursor: 'not-allowed',
                                userSelect: 'none',
                              }}
                            >
                              <Lock size={11} style={{ flexShrink: 0 }} />
                              {label}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            onClick={() => handleSelectSlot(slot)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px 12px',
                              borderRadius: '9999px',
                              border: isSelected ? '1.5px solid #059669' : '1px solid #10b981',
                              backgroundColor: isSelected ? '#059669' : 'transparent',
                              color: isSelected ? '#ffffff' : '#047857',
                              fontSize: '12px',
                              fontWeight: isSelected ? 700 : 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

                {/* Appointment Type (SearchableSelect) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Tipo de Cita' : 'Appointment Type'}
                  </label>
                  <SearchableSelect
                    options={typeOptions}
                    value={formData.type}
                    onChange={(val) => setFormData({ ...formData, type: val })}
                    placeholder={isSpanish ? 'Seleccionar tipo...' : 'Select type...'}
                    icon={<FileText size={14} />}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
                    {isSpanish ? 'Notas Internas' : 'Internal Notes'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={isSpanish ? 'Comentarios adicionales...' : 'Additional notes...'}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-heading)',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? (isSpanish ? 'Guardando...' : 'Saving...')
                    : formMode === 'create'
                    ? (isSpanish ? 'Programar Cita' : 'Schedule Appointment')
                    : (isSpanish ? 'Guardar Cambios' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW DETAILS MODAL (All Roles + Delete Action for Tenant Admin) */}
      {viewingAppointment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div
              className="modal-header"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-600)',
                  }}
                >
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      #{viewingAppointment.appointmentNumber}
                    </h3>
                    {(() => {
                      const st = STATUS_CONFIG[viewingAppointment.status] || STATUS_CONFIG.SCHEDULED;
                      return (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          {isSpanish ? st.labelEs : st.labelEn}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {getAppointmentTypeLabel(viewingAppointment.type, isSpanish)} • {viewingAppointment.date?.substring(0, 10)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAppointment(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}>
              
              {/* Quick Clinical Actions Toolbar */}
              {canAddOrUpdate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(148, 163, 184, 0.08)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {isSpanish ? 'Acciones Clínicas:' : 'Clinical Actions:'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {viewingAppointment.status === 'SCHEDULED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(viewingAppointment.id, 'IN_PROGRESS')}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={12} fill="#fff" />
                          <span>{isSpanish ? 'Iniciar Cita' : 'Start Appointment'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptCancel(viewingAppointment)}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#dc2626',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <XCircle size={12} />
                          <span>{isSpanish ? 'Cancelar' : 'Cancel'}</span>
                        </button>
                      </>
                    )}
                    {viewingAppointment.status === 'IN_PROGRESS' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(viewingAppointment.id, 'COMPLETED')}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#4f46e5',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>{isSpanish ? 'Finalizar Cita' : 'End Appointment'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptCancel(viewingAppointment)}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#dc2626',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <XCircle size={12} />
                          <span>{isSpanish ? 'Cancelar' : 'Cancel'}</span>
                        </button>
                      </>
                    )}
                    {viewingAppointment.status === 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(viewingAppointment.id, 'SCHEDULED')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '12px', padding: '5px 12px' }}
                      >
                        {isSpanish ? 'Reabrir Cita' : 'Re-open Appointment'}
                      </button>
                    )}
                    {viewingAppointment.status === 'COMPLETED' && (
                      <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                        <CheckCircle2 size={14} />
                        {isSpanish ? 'Cita completada exitosamente' : 'Appointment completed successfully'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Patient & Doctor Banner (Single unified panel) */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(148, 163, 184, 0.05)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Patient Information */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    {viewingAppointment.patient?.firstName?.[0] || 'P'}{viewingAppointment.patient?.fatherLastName?.[0] || ''}
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {viewingAppointment.patient?.firstName} {viewingAppointment.patient?.fatherLastName || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px' }}>
                      <span>Rec: {viewingAppointment.patient?.recordNumber || 'N/A'}</span>
                      {viewingAppointment.patient?.phoneNumber && (
                        <span>• {viewingAppointment.patient?.phoneCountryCode || '+52'} {viewingAppointment.patient?.phoneNumber}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Doctor Information */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {isSpanish ? 'DOCTOR ASIGNADO' : 'ASSIGNED DOCTOR'}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)', marginTop: '2px' }}>
                    Dr. {viewingAppointment.doctor?.name || 'Assigned Doctor'}
                  </div>
                </div>
              </div>

              {/* Timing & Execution Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                
                {/* Scheduled Schedule Panel */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(148, 163, 184, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <CalendarIcon size={14} style={{ color: 'var(--primary-600)' }} />
                    <span>{t('appointments.scheduledSchedule', isSpanish ? 'Horario Programado' : 'Scheduled Schedule')}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isSpanish ? 'Fecha' : 'Date'}:</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {viewingAppointment.date?.substring(0, 10)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isSpanish ? 'Hora y Duración' : 'Time & Duration'}:</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{viewingAppointment.startTime} - {viewingAppointment.endTime} ({viewingAppointment.durationMinutes}m)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actual Execution Panel */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: viewingAppointment.actualStartTime ? 'rgba(56, 189, 248, 0.02)' : 'rgba(148, 163, 184, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Clock size={14} style={{ color: viewingAppointment.actualStartTime ? '#059669' : 'var(--text-muted)' }} />
                      <span>{t('appointments.actualExecution', isSpanish ? 'Ejecución Real' : 'Actual Execution')}</span>
                    </div>
                    {viewingAppointment.actualStartTime && viewingAppointment.actualEndTime && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 7px', borderRadius: '10px' }}>
                        {calculateActualDuration(viewingAppointment.actualStartTime, viewingAppointment.actualEndTime)}m {isSpanish ? 'total' : 'total'}
                      </span>
                    )}
                  </div>

                  {viewingAppointment.actualStartTime ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Start Event */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669', marginTop: '5px' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {t('appointments.startTime', isSpanish ? 'Hora de Inicio' : 'Start Time')}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {formatTimeOnly(viewingAppointment.actualStartTime)}
                            <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({formatDateOnly(viewingAppointment.actualStartTime)})
                            </span>
                          </div>
                          {viewingAppointment.startedBy?.name && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {t('appointments.startedBy', isSpanish ? 'Iniciada por' : 'Started by')}: <strong style={{ color: 'var(--text-body)' }}>{viewingAppointment.startedBy.name}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* End Event */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: viewingAppointment.actualEndTime ? '#4f46e5' : '#d97706', marginTop: '5px' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {t('appointments.endTime', isSpanish ? 'Hora de Fin' : 'End Time')}
                          </div>
                          {viewingAppointment.actualEndTime ? (
                            <>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                                {formatTimeOnly(viewingAppointment.actualEndTime)}
                                <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                                  ({formatDateOnly(viewingAppointment.actualEndTime)})
                                </span>
                              </div>
                              {viewingAppointment.endedBy?.name && (
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  {t('appointments.endedBy', isSpanish ? 'Finalizada por' : 'Ended by')}: <strong style={{ color: 'var(--text-body)' }}>{viewingAppointment.endedBy.name}</strong>
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
                              {t('appointments.inProgressDesc', isSpanish ? 'La cita se encuentra en curso.' : 'Appointment is currently in progress.')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                      {t('appointments.notStartedDesc', isSpanish ? 'La cita aún no ha iniciado.' : 'Appointment has not been started yet.')}
                    </div>
                  )}
                </div>
              </div>

              {/* Services & Notes */}
              {(viewingAppointment.appointmentServices?.length || viewingAppointment.reason || viewingAppointment.notes || viewingAppointment.cancellationReason) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {viewingAppointment.cancellationReason && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12.5px', color: '#dc2626' }}>
                      <strong>{isSpanish ? 'Motivo de Cancelación' : 'Cancellation Reason'}:</strong> {viewingAppointment.cancellationReason}
                    </div>
                  )}

                  {/* Assigned Services with Prices */}
                  {viewingAppointment.appointmentServices && viewingAppointment.appointmentServices.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {isSpanish ? 'Servicios Asignados' : 'Assigned Services'}
                        </span>
                        {viewingAppointment.expectedAmount !== undefined && viewingAppointment.expectedAmount !== null && (
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#059669' }}>
                            {isSpanish ? 'Total: ' : 'Total: '}${Number(viewingAppointment.expectedAmount).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {viewingAppointment.appointmentServices.map((as) => (
                          <span
                            key={as.id}
                            style={{
                              fontSize: '12px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(99, 102, 241, 0.08)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              color: '#4f46e5',
                              fontWeight: 500,
                            }}
                          >
                            {as.serviceName} (${Number(as.unitPrice).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingAppointment.reason && !viewingAppointment.appointmentServices?.length && (
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {isSpanish ? 'Motivo de la Cita' : 'Reason for Visit'}
                      </span>
                      <div style={{ fontSize: '13px', color: 'var(--text-heading)', marginTop: '2px' }}>
                        {viewingAppointment.reason}
                      </div>
                    </div>
                  )}
                  {viewingAppointment.notes && (
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {isSpanish ? 'Notas Clínicas' : 'Clinical Notes'}
                      </span>
                      <div style={{ fontSize: '13px', color: 'var(--text-body)', marginTop: '2px', backgroundColor: 'rgba(148, 163, 184, 0.05)', padding: '8px 12px', borderRadius: '6px' }}>
                        {viewingAppointment.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* Tenant Admin Delete Button */}
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeletingAppointment(viewingAppointment);
                  }}
                  className="btn btn-danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Trash2 size={14} />
                  <span>{isSpanish ? 'Eliminar Cita' : 'Delete Appointment'}</span>
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                {canAddOrUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingAppointment;
                      setViewingAppointment(null);
                      openEditModal(target);
                    }}
                    className="btn btn-secondary"
                  >
                    {isSpanish ? 'Editar' : 'Edit'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingAppointment(null)}
                  className="btn btn-primary"
                >
                  {isSpanish ? 'Cerrar' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION (Tenant Admin ONLY) */}
      {deletingAppointment && canDelete && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rose-600)' }}>
                <AlertCircle size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  {isSpanish ? 'Confirmar Eliminación' : 'Confirm Deletion'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingAppointment(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--text-body)', margin: '0 0 12px' }}>
                {isSpanish
                  ? `¿Estás seguro de que deseas eliminar permanentemente la cita #${deletingAppointment.appointmentNumber}? Esta acción no se puede deshacer.`
                  : `Are you sure you want to permanently delete appointment #${deletingAppointment.appointmentNumber}? This action cannot be undone.`}
              </p>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  fontSize: '12px',
                  color: '#dc2626',
                  fontWeight: 500,
                }}
              >
                <Shield size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {isSpanish
                  ? 'Autorización exclusiva: Solo los Administradores de Tenant pueden eliminar registros de citas.'
                  : 'Exclusive authorization: Only Tenant Administrators have privilege to purge appointments.'}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingAppointment(null)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteAppointment}
                className="btn btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? (isSpanish ? 'Eliminando...' : 'Deleting...') : isSpanish ? 'Sí, Eliminar' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCEL APPOINTMENT CONFIRMATION */}
      {cancellingAppointment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <XCircle size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  {isSpanish ? 'Cancelar Cita' : 'Cancel Appointment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--text-body)', margin: '0 0 12px' }}>
                {isSpanish
                  ? `¿Deseas cancelar la cita #${cancellingAppointment.appointmentNumber} de ${cancellingAppointment.patient?.firstName || 'Paciente'}?`
                  : `Are you sure you want to cancel appointment #${cancellingAppointment.appointmentNumber} for ${cancellingAppointment.patient?.firstName || 'Patient'}?`}
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  {isSpanish ? 'Motivo de Cancelación (Opcional)' : 'Cancellation Reason (Optional)'}
                </label>
                <textarea
                  rows={3}
                  className="input"
                  value={cancellationReasonInput}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder={isSpanish ? 'Ej. Paciente no pudo asistir, cambio de fecha solicitado...' : 'e.g. Patient could not attend, requested reschedule...'}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                className="btn btn-secondary"
              >
                {isSpanish ? 'Mantener Cita' : 'Keep Appointment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = cancellingAppointment.id;
                  const reason = cancellationReasonInput.trim();
                  setCancellingAppointment(null);
                  handleStatusChange(targetId, 'CANCELLED', reason);
                }}
                className="btn btn-danger"
              >
                {isSpanish ? 'Confirmar Cancelación' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: QUICK CREATE PATIENT MODAL */}
      {isQuickPatientModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  {isSpanish ? 'Registrar Nuevo Paciente' : 'Create New Patient'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPatientModalOpen(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickPatientSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Nombre(s) *' : 'First Name *'}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={quickPatientData.firstName}
                    onChange={(e) => setQuickPatientData({ ...quickPatientData, firstName: e.target.value })}
                    required
                    placeholder={isSpanish ? 'Ej. Juan' : 'e.g. John'}
                    style={{ width: '100%', height: '40px', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Apellido Paterno' : 'Father Last Name'}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={quickPatientData.fatherLastName}
                      onChange={(e) => setQuickPatientData({ ...quickPatientData, fatherLastName: e.target.value })}
                      placeholder={isSpanish ? 'Ej. Pérez' : 'e.g. Doe'}
                      style={{ width: '100%', height: '40px', padding: '8px 10px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Apellido Materno' : 'Mother Last Name'}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={quickPatientData.motherLastName}
                      onChange={(e) => setQuickPatientData({ ...quickPatientData, motherLastName: e.target.value })}
                      placeholder={isSpanish ? 'Ej. García' : 'e.g. Smith'}
                      style={{ width: '100%', height: '40px', padding: '8px 10px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Teléfono Móvil' : 'Mobile Phone'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={quickPatientData.phoneCountryCode}
                        onChange={(val) => setQuickPatientData({ ...quickPatientData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="input"
                      value={quickPatientData.phoneNumber}
                      onChange={(e) => setQuickPatientData({ ...quickPatientData, phoneNumber: e.target.value })}
                      placeholder={isSpanish ? '10 dígitos...' : 'Phone number...'}
                      style={{ flex: 1, height: '40px', padding: '8px 10px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Correo Electrónico' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      className="input"
                      value={quickPatientData.email}
                      onChange={(e) => setQuickPatientData({ ...quickPatientData, email: e.target.value })}
                      placeholder="paciente@ejemplo.com"
                      style={{ width: '100%', height: '40px', padding: '8px 10px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      {isSpanish ? 'Género' : 'Gender'}
                    </label>
                    <SearchableSelect
                      options={[
                        { value: 'MALE', label: isSpanish ? 'Masculino' : 'Male' },
                        { value: 'FEMALE', label: isSpanish ? 'Femenino' : 'Female' },
                        { value: 'OTHER', label: isSpanish ? 'Otro' : 'Other' },
                        { value: 'PREFER_NOT_TO_SAY', label: isSpanish ? 'Prefiero no decir' : 'Prefer not to say' },
                      ]}
                      value={quickPatientData.gender}
                      onChange={(val) => setQuickPatientData({ ...quickPatientData, gender: val })}
                      placeholder={isSpanish ? 'Seleccione Género' : 'Select Gender'}
                      searchPlaceholder={isSpanish ? 'Buscar...' : 'Search...'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSpanish ? 'Alertas Médicas / Notas' : 'Medical Alerts / Notes'}
                  </label>
                  <textarea
                    rows={2}
                    className="input"
                    value={quickPatientData.notes}
                    onChange={(e) => setQuickPatientData({ ...quickPatientData, notes: e.target.value })}
                    placeholder={isSpanish ? 'Alergias o condiciones previas...' : 'Allergies, conditions or notes...'}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsQuickPatientModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={quickPatientSubmitting}
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={quickPatientSubmitting}
                >
                  {quickPatientSubmitting
                    ? (isSpanish ? 'Guardando...' : 'Saving...')
                    : (isSpanish ? 'Guardar y Seleccionar' : 'Save & Select')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
