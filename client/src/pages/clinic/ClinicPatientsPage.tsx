import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Pagination } from '../../components/common/Pagination';
import { formatDate } from '../../core/utils/dateUtils';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  X,
  Phone,
  Mail,
  MapPin,
  Pill,
  ShieldAlert,
  Building2,
  Eye,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Activity,
  User,
  Sparkles,
} from 'lucide-react';

interface PatientRecord {
  id: string;
  tenantId: string;
  branchId?: string | null;
  recordNumber: string;
  firstName: string;
  fatherLastName?: string | null;
  motherLastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  email?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactCountryCode?: string | null;
  emergencyContactPhone?: string | null;
  medications?: string | null;
  allergies?: string | null;
  referralSource?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code?: string;
  } | null;
}

interface PatientStats {
  total: number;
  active: number;
  newThisMonth: number;
  withAlerts: number;
}

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

type ModalTab = 'personal' | 'contact' | 'medical';

export const ClinicPatientsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { success, error } = useToast();

  // Patients Data & Pagination
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<PatientStats>({
    total: 0,
    active: 0,
    newThisMonth: 0,
    withAlerts: 0,
  });

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [availableBranches, setAvailableBranches] = useState<Array<{ id: string; name: string }>>([]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('personal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // View Modal State (Centered Dialog)
  const [viewingPatient, setViewingPatient] = useState<PatientRecord | null>(null);
  const [viewActiveTab, setViewActiveTab] = useState<ModalTab>('personal');

  // Delete modal
  const [deletePatientTarget, setDeletePatientTarget] = useState<PatientRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form State
  const initialFormState = {
    firstName: '',
    fatherLastName: '',
    motherLastName: '',
    gender: 'MALE',
    dateOfBirth: '',
    height: '',
    weight: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    branchId: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    address: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactCountryCode: '+52',
    emergencyContactPhone: '',
    medications: '',
    allergies: '',
    referralSource: '',
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Tenant Admin check for deletion and organization controls
  const isTenantAdmin = useMemo(() => {
    return (
      user?.isSuperAdmin ||
      user?.roles?.some((r: string) => {
        const lower = r.toLowerCase();
        return (
          lower === 'tenant-admin' ||
          lower.includes('tenant administrator') ||
          lower.includes('tenant admin')
        );
      })
    );
  }, [user]);

  // Load Branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches?moduleKey=CLINIC');
        const list = Array.isArray(res.data) ? res.data : res.data?.branches || [];
        setAvailableBranches(list);
      } catch (err) {
        // Silent fallback
      }
    };
    fetchBranches();
  }, []);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const url = branchFilter !== 'ALL' ? `/clinic/patients/stats?branchId=${branchFilter}` : '/clinic/patients/stats';
      const res = await api.get(url);
      setStats(res.data);
    } catch (err) {
      // stats fallback
    }
  }, [branchFilter]);

  // Fetch Patients List
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (branchFilter !== 'ALL') params.append('branchId', branchFilter);

      const res = await api.get(`/clinic/patients?${params.toString()}`);
      const data = res.data;
      setPatients(data.patients || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      error(t('clinicPatients.alerts.loadFailed', 'Failed to load patients list.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, branchFilter, error, t]);

  useEffect(() => {
    fetchPatients();
    fetchStats();
  }, [fetchPatients, fetchStats]);

  // Real-time Age calculation
  const calculatedAge = useMemo(() => {
    if (!formData.dateOfBirth) return null;
    const dob = new Date(formData.dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }, [formData.dateOfBirth]);

  // Live BMI calculation
  const calculatedBmi = useMemo(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightInMeters = h / 100;
    const bmiVal = w / (heightInMeters * heightInMeters);
    const rounded = Math.round(bmiVal * 10) / 10;

    let category = 'Normal';
    let color = '#10b981';
    let bg = 'rgba(16, 185, 129, 0.12)';

    if (rounded < 18.5) {
      category = 'Underweight';
      color = '#d97706';
      bg = 'rgba(217, 119, 6, 0.12)';
    } else if (rounded >= 25 && rounded < 30) {
      category = 'Overweight';
      color = '#d97706';
      bg = 'rgba(217, 119, 6, 0.12)';
    } else if (rounded >= 30) {
      category = 'Obese';
      color = '#e11d48';
      bg = 'rgba(225, 29, 72, 0.12)';
    }

    return { value: rounded, category, color, bg };
  }, [formData.height, formData.weight]);

  // Full name helper
  const formatFullName = (p: { firstName: string; fatherLastName?: string | null; motherLastName?: string | null }) => {
    return [p.firstName, p.fatherLastName, p.motherLastName].filter(Boolean).join(' ');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingPatientId(null);
    setFormData({
      ...initialFormState,
      branchId: availableBranches[0]?.id || '',
    });
    setFormErrors({});
    setActiveTab('personal');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (p: PatientRecord) => {
    setModalMode('edit');
    setEditingPatientId(p.id);
    let dobString = '';
    if (p.dateOfBirth) {
      dobString = p.dateOfBirth.substring(0, 10);
    }
    setFormData({
      firstName: p.firstName || '',
      fatherLastName: p.fatherLastName || '',
      motherLastName: p.motherLastName || '',
      gender: p.gender || 'MALE',
      dateOfBirth: dobString,
      height: p.height !== null && p.height !== undefined ? p.height.toString() : '',
      weight: p.weight !== null && p.weight !== undefined ? p.weight.toString() : '',
      status: p.status,
      branchId: p.branch?.id || p.branchId || '',
      email: p.email || '',
      phoneCountryCode: p.phoneCountryCode || '+52',
      phoneNumber: p.phoneNumber || '',
      address: p.address || '',
      emergencyContactName: p.emergencyContactName || '',
      emergencyContactRelation: p.emergencyContactRelation || '',
      emergencyContactCountryCode: p.emergencyContactCountryCode || '+52',
      emergencyContactPhone: p.emergencyContactPhone || '',
      medications: p.medications || '',
      allergies: p.allergies || '',
      referralSource: p.referralSource || '',
      notes: p.notes || '',
    });
    setFormErrors({});
    setActiveTab('personal');
    setIsModalOpen(true);
  };

  // Step-by-Step Next Tab Handler
  const handleNextTab = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (activeTab === 'personal') {
      const errors: Record<string, string> = {};
      if (!formData.firstName.trim()) {
        errors.firstName = t('clinicPatients.modal.nameRequired', 'First name is required');
      }
      if (!formData.dateOfBirth) {
        errors.dateOfBirth = t('clinicPatients.modal.dobRequired', 'Date of birth is required');
      }
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      setFormErrors({});
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      const errors: Record<string, string> = {};
      if (!formData.phoneNumber.trim()) {
        errors.phoneNumber = t('clinicPatients.modal.phoneRequired', 'Contact phone number is required');
      }
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      setFormErrors({});
      setActiveTab('medical');
    }
  };

  // Full validation before saving
  const validateAll = () => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) {
      errors.firstName = t('clinicPatients.modal.nameRequired', 'First name is required');
    }
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = t('clinicPatients.modal.dobRequired', 'Date of birth is required');
    }
    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = t('clinicPatients.modal.phoneRequired', 'Contact phone number is required');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Save (only called on Final tab or submit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      if (!formData.firstName.trim() || !formData.dateOfBirth) {
        setActiveTab('personal');
      } else if (!formData.phoneNumber.trim()) {
        setActiveTab('contact');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        fatherLastName: formData.fatherLastName.trim() || undefined,
        motherLastName: formData.motherLastName.trim() || undefined,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        status: formData.status,
        branchId: formData.branchId || undefined,
        email: formData.email.trim() || undefined,
        phoneCountryCode: formData.phoneCountryCode,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        address: formData.address.trim() || undefined,
        emergencyContactName: formData.emergencyContactName.trim() || undefined,
        emergencyContactRelation: formData.emergencyContactRelation.trim() || undefined,
        emergencyContactCountryCode: formData.emergencyContactCountryCode,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || undefined,
        medications: formData.medications.trim() || undefined,
        allergies: formData.allergies.trim() || undefined,
        referralSource: formData.referralSource || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (modalMode === 'create') {
        await api.post('/clinic/patients', payload);
        success(t('clinicPatients.alerts.createSuccess', 'Patient registered successfully.'));
      } else if (editingPatientId) {
        await api.patch(`/clinic/patients/${editingPatientId}`, payload);
        success(t('clinicPatients.alerts.updateSuccess', 'Patient updated successfully.'));
      }

      setIsModalOpen(false);
      fetchPatients();
      fetchStats();
    } catch (err: any) {
      const msg = err.response?.data?.message || (modalMode === 'create' ? t('clinicPatients.alerts.createFailed') : t('clinicPatients.alerts.updateFailed'));
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete (Strictly for Tenant Admin)
  const handleDeleteConfirm = async () => {
    if (!deletePatientTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/clinic/patients/${deletePatientTarget.id}`);
      success(t('clinicPatients.alerts.deleteSuccess', 'Patient record removed successfully.'));
      setDeletePatientTarget(null);
      fetchPatients();
      fetchStats();
    } catch (err: any) {
      error(err.response?.data?.message || t('clinicPatients.alerts.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ──────────────── Header Section ──────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600, #0284c7)',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('clinicPatients.pageTitle', 'Clinic Patients')}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('clinicPatients.pageSubtitle', 'Manage clinical patient records, contact directories, medical alerts, and intake history.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.25)',
          }}
        >
          <UserPlus size={16} />
          <span>{t('clinicPatients.addPatientBtn', 'New Patient')}</span>
        </button>
      </div>

      {/* ──────────────── KPI Statistics Cards ──────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('clinicPatients.stats.total', 'Total Patients')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('clinicPatients.stats.active', 'Active Patients')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.active}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('clinicPatients.stats.newThisMonth', 'New This Month')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.newThisMonth}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('clinicPatients.stats.withAlerts', 'Medical Alerts')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {stats.withAlerts}
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── Search & Filter Toolbar ──────────────── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flex: 1, minWidth: '260px', position: 'relative' }}>
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
            placeholder={t('clinicPatients.searchPlaceholder', 'Search by patient name, record #, phone, or email...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '38px', height: '40px', width: '100%', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '150px', height: '40px', fontSize: '13px' }}
          >
            <option value="ALL">{t('clinicPatients.allStatus', 'All Statuses')}</option>
            <option value="ACTIVE">{t('clinicPatients.activeOnly', 'Active')}</option>
            <option value="INACTIVE">{t('clinicPatients.inactiveOnly', 'Inactive')}</option>
          </select>

          {isTenantAdmin && availableBranches.length > 0 && (
            <select
              className="input"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '170px', height: '40px', fontSize: '13px' }}
            >
              <option value="ALL">{t('clinicPatients.allBranches', 'All Branches')}</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ──────────────── Dedicated Data Table (Pure Table Format) ──────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', margin: 0 }}>{t('common.loading', 'Loading patients...')}</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-primary-bg)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Users size={26} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-heading)' }}>
              {t('clinicPatients.table.emptyTitle', 'No Patients Found')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              {t('clinicPatients.table.emptyHelp', 'Get started by clicking "+ New Patient" to register clinical records.')}
            </p>
            <button type="button" className="btn btn-primary" onClick={handleOpenCreate} style={{ fontSize: '13px' }}>
              <UserPlus size={15} style={{ marginRight: '6px' }} />
              {t('clinicPatients.addPatientBtn', 'New Patient')}
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '26%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.patient', 'Patient Name & Record')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '12%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.ageGender', 'Age / Gender')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '20%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.contact', 'Contact Info')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '16%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.medicalAlert', 'Medical Alert')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '14%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.branch', 'Branch')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'center', width: '6%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.status', 'Status')}
                    </th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', width: '6%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('clinicPatients.table.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => {
                    const fullName = formatFullName(p);
                    const hasAllergies = Boolean(p.allergies && p.allergies.trim().length > 0);
                    let pAge: number | null = null;
                    if (p.dateOfBirth) {
                      const dob = new Date(p.dateOfBirth);
                      if (!isNaN(dob.getTime())) {
                        const today = new Date();
                        let a = today.getFullYear() - dob.getFullYear();
                        const m = today.getMonth() - dob.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
                        if (a >= 0) pAge = a;
                      }
                    }

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Patient Name & Record Folio */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--badge-primary-bg)',
                                color: 'var(--primary-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                flexShrink: 0,
                              }}
                            >
                              {p.firstName?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{fullName}</div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  color: 'var(--primary-600)',
                                  backgroundColor: 'var(--badge-primary-bg)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginTop: '2px',
                                  display: 'inline-block',
                                }}
                              >
                                {p.recordNumber}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Age & Gender */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                              {pAge !== null ? `${pAge} yrs` : '—'}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                textTransform: 'capitalize',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--badge-neutral-bg, #f1f5f9)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {p.gender?.toLowerCase() || 'unspecified'}
                            </span>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td style={{ padding: '14px 18px' }}>
                          <div>
                            {p.phoneNumber ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 600 }}>
                                  {p.phoneCountryCode || '+52'} {p.phoneNumber}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                            {p.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                <Mail size={11} />
                                <span>{p.email}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Medical Alert */}
                        <td style={{ padding: '14px 18px' }}>
                          {hasAllergies ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                              }}
                            >
                              <ShieldAlert size={12} />
                              <span>{p.allergies}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {t('clinicPatients.table.noAlerts', 'No alerts')}
                            </span>
                          )}
                        </td>

                        {/* Branch */}
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>
                            {p.branch?.name || '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                p.status === 'ACTIVE'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : 'rgba(100, 116, 139, 0.12)',
                              color: p.status === 'ACTIVE' ? '#10b981' : '#64748b',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: p.status === 'ACTIVE' ? '#10b981' : '#64748b',
                              }}
                            />
                            {p.status === 'ACTIVE' ? t('clinicPatients.modal.statusActive') : t('clinicPatients.modal.statusInactive')}
                          </span>
                        </td>

                        {/* Actions (Delete only visible for Tenant Admin) */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setViewingPatient(p);
                                setViewActiveTab('personal');
                              }}
                              title={t('clinicPatients.table.viewDetails', 'View Profile')}
                              style={{ padding: '6px', borderRadius: '6px' }}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => handleOpenEdit(p)}
                              title={t('clinicPatients.table.edit', 'Edit Patient')}
                              style={{ padding: '6px', borderRadius: '6px' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            {isTenantAdmin && (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeletePatientTarget(p)}
                                title={t('clinicPatients.table.delete', 'Delete Patient')}
                                style={{ padding: '6px', borderRadius: '6px', color: '#ef4444' }}
                              >
                                <Trash2 size={15} />
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

            {/* Pagination Footer */}
            {totalCount > 0 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={limit}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(newSize) => {
                  setLimit(newSize);
                  setPage(1);
                }}
                totalItems={totalCount}
              />
            )}
          </>
        )}
      </div>

      {/* ──────────────── ZERO-SCROLL TABBED REGISTRATION / EDIT MODAL ──────────────── */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Pinned Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--badge-primary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-600)',
                  }}
                >
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                    {modalMode === 'create'
                      ? t('clinicPatients.modal.createTitle', 'Register New Patient')
                      : t('clinicPatients.modal.editTitle', 'Edit Patient Record')}
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('clinicPatients.pageSubtitle', 'Fill out clinical and demographic intake.')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsModalOpen(false)}
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs Navigation Header (Personal | Contact | Medical) */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '4px 14px 0',
                gap: '8px',
              }}
            >
              {[
                { id: 'personal', label: t('clinicPatients.tabs.personal', 'Personal'), icon: User, hasError: formErrors.firstName || formErrors.dateOfBirth },
                { id: 'contact', label: t('clinicPatients.tabs.contact', 'Contact'), icon: Phone, hasError: formErrors.phoneNumber },
                { id: 'medical', label: t('clinicPatients.tabs.medical', 'Medical'), icon: Pill, hasError: false },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setFormErrors({});
                      setActiveTab(tab.id as ModalTab);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--primary-600)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                    {tab.hasError && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          marginLeft: '2px',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Body & Safe Form Submission Handler */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (activeTab === 'medical') {
                  handleSave(e);
                } else {
                  handleNextTab();
                }
              }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* ──── TAB 1: PERSONAL ──── */}
                {activeTab === 'personal' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.name', 'First Name')} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className={`input ${formErrors.firstName ? 'is-invalid' : ''}`}
                          placeholder="e.g. Maria"
                          value={formData.firstName}
                          onChange={(e) => {
                            setFormData({ ...formData, firstName: e.target.value });
                            if (formErrors.firstName) setFormErrors({ ...formErrors, firstName: '' });
                          }}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                        {formErrors.firstName && (
                          <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                            {formErrors.firstName}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.fatherLastName', "Father's Last Name")}
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Rodriguez"
                          value={formData.fatherLastName}
                          onChange={(e) => setFormData({ ...formData, fatherLastName: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.motherLastName', "Mother's Last Name")}
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Lopez"
                          value={formData.motherLastName}
                          onChange={(e) => setFormData({ ...formData, motherLastName: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', alignItems: 'flex-start' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.gender', 'Gender')}
                        </label>
                        <select
                          className="input"
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        >
                          <option value="MALE">{t('clinicPatients.modal.genderMale', 'Male')}</option>
                          <option value="FEMALE">{t('clinicPatients.modal.genderFemale', 'Female')}</option>
                          <option value="OTHER">{t('clinicPatients.modal.genderOther', 'Other')}</option>
                          <option value="PREFER_NOT_TO_SAY">{t('clinicPatients.modal.genderPreferNotToSay', 'Prefer not to say')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.dateOfBirth', 'Date of Birth')} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="date"
                          className={`input ${formErrors.dateOfBirth ? 'is-invalid' : ''}`}
                          value={formData.dateOfBirth}
                          onChange={(e) => {
                            setFormData({ ...formData, dateOfBirth: e.target.value });
                            if (formErrors.dateOfBirth) setFormErrors({ ...formErrors, dateOfBirth: '' });
                          }}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {calculatedAge !== null ? (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--primary-600)',
                                backgroundColor: 'var(--badge-primary-bg)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              {t('clinicPatients.modal.ageCalculated', '{{age}} years old', { age: calculatedAge })}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t('clinicPatients.modal.ageHint', 'Age will be calculated automatically')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.status', 'Status')}
                        </label>
                        <select
                          className="input"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        >
                          <option value="ACTIVE">{t('clinicPatients.modal.statusActive', 'Active')}</option>
                          <option value="INACTIVE">{t('clinicPatients.modal.statusInactive', 'Inactive')}</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', alignItems: 'flex-start' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.height', 'Height')} ({t('clinicPatients.modal.heightUnit', 'cm')})
                        </label>
                        <input
                          type="number"
                          className="input"
                          placeholder="e.g. 170"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.weight', 'Weight')} ({t('clinicPatients.modal.weightUnit', 'kg')})
                        </label>
                        <input
                          type="number"
                          className="input"
                          placeholder="e.g. 68"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.bmi', 'BMI Indicator')}
                        </label>
                        <div
                          style={{
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 12px',
                            borderRadius: '8px',
                            backgroundColor: calculatedBmi ? calculatedBmi.bg : 'var(--bg-secondary)',
                            color: calculatedBmi ? calculatedBmi.color : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {calculatedBmi ? (
                            <span>
                              BMI: <strong>{calculatedBmi.value}</strong> ({calculatedBmi.category})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Enter height & weight</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isTenantAdmin && availableBranches.length > 0 && (
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.table.branch', 'Clinic Branch')}
                        </label>
                        <select
                          className="input"
                          value={formData.branchId}
                          onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        >
                          <option value="">{t('clinicPatients.allBranches', 'All Branches')}</option>
                          {availableBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* ──── TAB 2: CONTACT ──── */}
                {activeTab === 'contact' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.phone', 'Contact Number')} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ width: '90px', flexShrink: 0 }}>
                            <SearchableSelect
                              options={COUNTRY_DIALING_CODES}
                              value={formData.phoneCountryCode}
                              onChange={(val) => setFormData({ ...formData, phoneCountryCode: val })}
                            />
                          </div>
                          <input
                            type="tel"
                            className={`input ${formErrors.phoneNumber ? 'is-invalid' : ''}`}
                            placeholder="55 1234 5678"
                            value={formData.phoneNumber}
                            onChange={(e) => {
                              setFormData({ ...formData, phoneNumber: e.target.value });
                              if (formErrors.phoneNumber) setFormErrors({ ...formErrors, phoneNumber: '' });
                            }}
                            style={{ flex: 1, width: '100%', height: '38px', fontSize: '13px' }}
                          />
                        </div>
                        {formErrors.phoneNumber && (
                          <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                            {formErrors.phoneNumber}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.email', 'Email Address')}
                        </label>
                        <input
                          type="email"
                          className="input"
                          placeholder="patient@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          style={{ height: '38px', fontSize: '13px', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                        {t('clinicPatients.modal.address', 'Address')}
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder={t('clinicPatients.modal.addressPlaceholder', 'Street, number, neighborhood...')}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        style={{ height: '38px', fontSize: '13px', width: '100%' }}
                      />
                    </div>

                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Phone size={13} />
                        </div>
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading)', display: 'block' }}>
                            {t('clinicPatients.modal.emergencySection', 'Guardian / Emergency Contact')}
                          </span>
                        </div>
                      </div>

                      {/* Row 1: Contact Name and Relationship (2 balanced columns) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                            {t('clinicPatients.modal.emergencyName', 'Contact Name')}
                          </label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. Carlos Rodriguez"
                            value={formData.emergencyContactName}
                            onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                            style={{ height: '38px', fontSize: '13px', width: '100%' }}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                            {t('clinicPatients.modal.emergencyRelation', 'Contact Relation')}
                          </label>
                          <input
                            type="text"
                            className="input"
                            placeholder={t('clinicPatients.modal.emergencyRelationPlaceholder', 'e.g. Parent, Spouse, Sibling')}
                            value={formData.emergencyContactRelation}
                            onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                            style={{ height: '38px', fontSize: '13px', width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Row 2: Emergency Contact Phone with ample width */}
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.emergencyPhone', 'Contact Phone')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ width: '90px', flexShrink: 0 }}>
                            <SearchableSelect
                              options={COUNTRY_DIALING_CODES}
                              value={formData.emergencyContactCountryCode}
                              onChange={(val) => setFormData({ ...formData, emergencyContactCountryCode: val })}
                            />
                          </div>
                          <input
                            type="tel"
                            className="input"
                            placeholder="55 9876 5432"
                            value={formData.emergencyContactPhone}
                            onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                            style={{ flex: 1, width: '100%', height: '38px', fontSize: '13px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ──── TAB 3: MEDICAL ──── */}
                {activeTab === 'medical' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          <Pill size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          {t('clinicPatients.modal.medications', 'Current Medications')}
                        </label>
                        <textarea
                          className="input"
                          placeholder={t('clinicPatients.modal.medicationsPlaceholder', 'Add current medications...')}
                          rows={3}
                          value={formData.medications}
                          onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                          style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
                            <ShieldAlert size={12} style={{ display: 'inline', marginRight: '4px', color: '#ef4444', verticalAlign: 'middle' }} />
                            {t('clinicPatients.modal.allergies', 'Known Allergies')}
                          </label>
                          {formData.allergies.trim() && (
                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>
                              {t('clinicPatients.modal.allergiesWarning', 'Medical Alert')}
                            </span>
                          )}
                        </div>
                        <textarea
                          className="input"
                          placeholder={t('clinicPatients.modal.allergiesPlaceholder', 'List any known allergies (penicillin, latex, etc.)...')}
                          rows={3}
                          value={formData.allergies}
                          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                          style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.referralSource', 'How did you hear about our clinic?')}
                        </label>
                        <select
                          className="input"
                          value={formData.referralSource}
                          onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
                          style={{ height: '38px', fontSize: '12px', width: '100%' }}
                        >
                          <option value="">{t('clinicPatients.modal.referralSelect', 'Select an option')}</option>
                          <option value="GOOGLE">{t('clinicPatients.modal.referralGoogle', 'Google Search')}</option>
                          <option value="SOCIAL_MEDIA">{t('clinicPatients.modal.referralSocial', 'Social Media (Instagram/Facebook)')}</option>
                          <option value="FRIEND_FAMILY">{t('clinicPatients.modal.referralFriend', 'Friend or Family Recommendation')}</option>
                          <option value="DOCTOR_REFERRAL">{t('clinicPatients.modal.referralDoctor', 'Doctor or Specialist Referral')}</option>
                          <option value="WALK_IN">{t('clinicPatients.modal.referralWalkin', 'Walk-in / Clinic Signage')}</option>
                          <option value="WEBSITE">{t('clinicPatients.modal.referralWebsite', 'Clinic Website')}</option>
                          <option value="OTHER">{t('clinicPatients.modal.referralOther', 'Other')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                          {t('clinicPatients.modal.description', 'Internal Description / Notes')}
                        </label>
                        <textarea
                          className="input"
                          placeholder={t('clinicPatients.modal.descriptionPlaceholder', 'Add internal clinical reception notes...')}
                          rows={3}
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Modal Navigation Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 22px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                  style={{ fontSize: '13px' }}
                >
                  {t('clinicPatients.modal.cancelBtn', 'Cancel')}
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeTab !== 'personal' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        if (activeTab === 'medical') setActiveTab('contact');
                        else if (activeTab === 'contact') setActiveTab('personal');
                      }}
                      style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ChevronLeft size={14} />
                      {t('clinicPatients.modal.prevBtn', 'Previous')}
                    </button>
                  )}

                  {activeTab !== 'medical' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={(e) => handleNextTab(e)}
                      style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>{t('clinicPatients.modal.nextBtn', 'Next')}</span>
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting}
                      style={{ fontSize: '13px' }}
                    >
                      {isSubmitting
                        ? t('clinicPatients.modal.savingBtn', 'Saving...')
                        : modalMode === 'create'
                        ? t('clinicPatients.modal.saveBtn', 'Save Patient')
                        : t('clinicPatients.modal.updateBtn', 'Update Patient')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── CENTERED VIEW PATIENT MODAL (CONSISTENT MODAL STYLE) ──────────────── */}
      {viewingPatient && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1060,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setViewingPatient(null)}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Centered Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(14, 165, 233, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-600, #0284c7)',
                    fontWeight: 700,
                  }}
                >
                  {viewingPatient.firstName?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                    {formatFullName(viewingPatient)}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'var(--primary-600, #0284c7)',
                        backgroundColor: 'rgba(14, 165, 233, 0.08)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {viewingPatient.recordNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        backgroundColor:
                          viewingPatient.status === 'ACTIVE'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(100, 116, 139, 0.12)',
                        color: viewingPatient.status === 'ACTIVE' ? '#10b981' : '#64748b',
                      }}
                    >
                      {viewingPatient.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setViewingPatient(null)}
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* View Modal Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                padding: '4px 16px 0',
                gap: '8px',
              }}
            >
              {[
                { id: 'personal', label: t('clinicPatients.tabs.personal', 'Personal'), icon: User },
                { id: 'contact', label: t('clinicPatients.tabs.contact', 'Contact'), icon: Phone },
                { id: 'medical', label: t('clinicPatients.tabs.medical', 'Medical'), icon: Pill },
              ].map((tab) => {
                const isActive = viewActiveTab === tab.id;
                const IconComponent = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewActiveTab(tab.id as ModalTab)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--primary-600, #0284c7)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--primary-600, #0284c7)' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* View Modal Body */}
            <div style={{ padding: '20px 22px' }}>
              {viewActiveTab === 'personal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.modal.gender')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>{viewingPatient.gender || '—'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.modal.dateOfBirth')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>
                        {viewingPatient.dateOfBirth ? formatDate(viewingPatient.dateOfBirth) : '—'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.modal.height')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>{viewingPatient.height ? `${viewingPatient.height} cm` : '—'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.modal.weight')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>{viewingPatient.weight ? `${viewingPatient.weight} kg` : '—'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.table.branch')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>{viewingPatient.branch?.name || '—'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.table.registered')}:
                      </span>
                      <div style={{ fontWeight: 600 }}>{formatDate(viewingPatient.createdAt)}</div>
                    </div>
                  </div>
                </div>
              )}

              {viewActiveTab === 'contact' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} style={{ color: 'var(--primary-600)' }} />
                      <span style={{ fontWeight: 600 }}>
                        {viewingPatient.phoneCountryCode || '+52'} {viewingPatient.phoneNumber || '—'}
                      </span>
                    </div>
                    {viewingPatient.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{viewingPatient.email}</span>
                      </div>
                    )}
                    {viewingPatient.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{viewingPatient.address}</span>
                      </div>
                    )}
                  </div>

                  {viewingPatient.emergencyContactName && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {t('clinicPatients.modal.emergencySection', 'Guardian / Emergency Contact')}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{viewingPatient.emergencyContactName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {viewingPatient.emergencyContactRelation || 'Emergency Contact'} • {viewingPatient.emergencyContactCountryCode || '+52'} {viewingPatient.emergencyContactPhone || ''}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewActiveTab === 'medical' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {viewingPatient.allergies ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#ef4444',
                      }}
                    >
                      <ShieldAlert size={16} />
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                          {t('clinicPatients.modal.allergiesWarning', 'Medical Alert')}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{viewingPatient.allergies}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      No critical allergies recorded.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                        {t('clinicPatients.modal.medications')}:
                      </span>
                      <div style={{ fontWeight: 500 }}>{viewingPatient.medications || 'None recorded'}</div>
                    </div>
                    {viewingPatient.referralSource && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                          {t('clinicPatients.modal.referralSource')}:
                        </span>
                        <div style={{ fontWeight: 500 }}>{viewingPatient.referralSource}</div>
                      </div>
                    )}
                    {viewingPatient.notes && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                          {t('clinicPatients.modal.description')}:
                        </span>
                        <div style={{ fontWeight: 500 }}>{viewingPatient.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Centered Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--header-bg, #ffffff)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingPatient(null)}
                style={{ fontSize: '13px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const p = viewingPatient;
                  setViewingPatient(null);
                  handleOpenEdit(p);
                }}
                style={{ fontSize: '13px' }}
              >
                <Edit2 size={14} style={{ marginRight: '6px' }} />
                {t('clinicPatients.table.edit', 'Edit Patient')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── DELETE CONFIRMATION DIALOG (STRICT TENANT ADMIN) ──────────────── */}
      {deletePatientTarget && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1070,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '16px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-heading)' }}>
              {t('clinicPatients.deleteModal.title', 'Delete Patient Record?')}
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              {t(
                'clinicPatients.deleteModal.confirmText',
                'Are you sure you want to delete patient {{name}} ({{recordNumber}})? This action cannot be undone.',
                {
                  name: formatFullName(deletePatientTarget),
                  recordNumber: deletePatientTarget.recordNumber,
                }
              )}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletePatientTarget(null)}
                disabled={isDeleting}
                style={{ fontSize: '13px' }}
              >
                {t('clinicPatients.modal.cancelBtn', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{ fontSize: '13px' }}
              >
                {isDeleting ? t('clinicPatients.modal.savingBtn', 'Deleting...') : t('clinicPatients.table.delete', 'Delete Patient')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
