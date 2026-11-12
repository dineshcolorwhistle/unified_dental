import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { formatDate, getTodayDateString } from '../../core/utils/dateUtils';
import { exportToCSV, type ExportColumnDef } from '../../core/utils/exportUtils';
import {
  Stethoscope,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  Edit2,
  X,
  Clock,
  Users,
  ShieldAlert,
  Award,
  MapPin,
  Palette,
  Check,
  Briefcase,
  Lock,
  Download,
} from 'lucide-react';
import {
  specializationService,
  SpecializationItem,
} from '../../services/specializationService';
import {
  clinicServiceService,
  ClinicServiceItem,
} from '../../services/clinicServiceService';

export interface DoctorAssignedService {
  serviceId: string;
  customPrice: number;
  serviceName?: string;
  basePrice?: number;
}

interface ClinicDoctorRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string | null;
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  avatarUrl?: string;
  specialization: string;
  qualification?: string | null;
  licenseNumber?: string | null;
  colorCode?: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    code?: string;
  } | null;
  roles: string[];
  services?: DoctorAssignedService[];
}

export const PRESET_DOCTOR_COLORS = [
  { hex: '#0EA5E9', name: 'Sky Blue' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#8B5CF6', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#D946EF', name: 'Fuchsia' },
  { hex: '#E11D48', name: 'Rose' },
  { hex: '#059669', name: 'Sea Green' },
  { hex: '#7C3AED', name: 'Violet' },
  { hex: '#D97706', name: 'Ochre' },
];

export const getDuplicateColorDoctor = (
  hex?: string,
  doctors: ClinicDoctorRecord[] = [],
  excludeId?: string,
): ClinicDoctorRecord | undefined => {
  if (!hex) return undefined;
  const normalized = hex.trim().toUpperCase();
  return doctors.find(
    (d) =>
      d.id !== excludeId &&
      d.colorCode &&
      d.colorCode.trim().toUpperCase() === normalized,
  );
};

export const findNextAvailableColor = (
  doctors: ClinicDoctorRecord[] = [],
  excludeId?: string,
): string => {
  for (const preset of PRESET_DOCTOR_COLORS) {
    if (!getDuplicateColorDoctor(preset.hex, doctors, excludeId)) {
      return preset.hex;
    }
  }
  return PRESET_DOCTOR_COLORS[0].hex;
};

const DoctorColorPicker: React.FC<{
  value: string;
  onChange: (color: string) => void;
  existingDoctors: ClinicDoctorRecord[];
  currentDoctorId?: string;
}> = ({ value, onChange, existingDoctors, currentDoctorId }) => {
  const { t } = useTranslation();
  const duplicateDoc = useMemo(() => {
    return getDuplicateColorDoctor(value, existingDoctors, currentDoctorId);
  }, [value, existingDoctors, currentDoctorId]);

  return (
    <div>
      <div style={{ marginBottom: '6px' }}>
        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Palette size={13} style={{ color: 'var(--primary-600)' }} />
          <span>{t('clinicDoctors.modal.colorCode', 'Doctor Calendar Color')}</span>
        </label>
      </div>

      {/* Simplified Doctor Color Section: Swatch Picker + Hex Input (Preset colors removed) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            position: 'relative',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: value || '#0EA5E9',
          }}
        >
          <input
            type="color"
            value={value || '#0EA5E9'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            style={{
              position: 'absolute',
              top: '-10px',
              left: '-10px',
              width: '48px',
              height: '48px',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              opacity: 0,
            }}
            title={t('clinicDoctors.modal.selectColor', 'Select Color')}
          />
        </div>
        <input
          type="text"
          placeholder="#HEX"
          value={value || ''}
          maxLength={7}
          onChange={(e) => {
            let val = e.target.value.trim().toUpperCase();
            if (!val.startsWith('#') && val.length > 0) val = '#' + val;
            onChange(val);
          }}
          style={{
            width: '90px',
            height: '32px',
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: '12.5px',
            fontWeight: 700,
            borderRadius: '6px',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-heading)',
          }}
        />
      </div>

      {/* Duplicate Alert */}
      {duplicateDoc && (
        <div
          style={{
            marginTop: '6px',
            padding: '5px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            color: '#ef4444',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>
            {t('clinicDoctors.modal.colorDuplicate', {
              name: duplicateDoc.name,
              defaultValue: `Color already assigned to Dr. ${duplicateDoc.name}. Please select a unique color.`,
            })}
          </span>
        </div>
      )}
    </div>
  );
};

export interface ServicePriceItemState {
  isAssigned: boolean;
  customPrice: string;
}

const DoctorServicesPricingSection: React.FC<{
  services: ClinicServiceItem[];
  loading: boolean;
  value: Record<string, ServicePriceItemState>;
  onChange: (updated: Record<string, ServicePriceItemState>) => void;
}> = ({ services, loading, value, onChange }) => {
  const { t } = useTranslation();
  const [searchFilter, setSearchFilter] = useState('');

  const filteredServices = useMemo(() => {
    if (!searchFilter.trim()) return services;
    const q = searchFilter.toLowerCase().trim();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)),
    );
  }, [services, searchFilter]);

  const assignedCount = useMemo(() => {
    return Object.values(value).filter((v) => v.isAssigned).length;
  }, [value]);

  const toggleService = (serviceId: string, basePrice: number | string) => {
    const current = value[serviceId] || {
      isAssigned: false,
      customPrice: Number(basePrice).toFixed(2),
    };
    const nextAssigned = !current.isAssigned;
    onChange({
      ...value,
      [serviceId]: {
        isAssigned: nextAssigned,
        customPrice: current.customPrice || Number(basePrice).toFixed(2),
      },
    });
  };

  const updatePrice = (serviceId: string, newPrice: string) => {
    const current = value[serviceId];
    if (!current) return;
    onChange({
      ...value,
      [serviceId]: {
        ...current,
        customPrice: newPrice,
      },
    });
  };

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        marginTop: '6px',
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={14} style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('clinicDoctors.services.title', 'Services & Custom Pricing')}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '10px',
                backgroundColor: assignedCount > 0 ? 'var(--badge-primary-bg)' : 'var(--bg-card)',
                color: assignedCount > 0 ? 'var(--primary-600)' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {assignedCount} {t('clinicDoctors.services.assigned', 'assigned')}
            </span>
          </div>

          {services.length > 3 && (
            <div style={{ position: 'relative', width: '180px' }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder={t('common.search', 'Search services...')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: '26px',
                  paddingLeft: '24px',
                  paddingRight: '6px',
                  fontSize: '11.5px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-heading)',
                }}
              />
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {t(
            'clinicDoctors.services.subtitle',
            'Assign services and specify custom doctor rates. The service base price is shown for reference only and cannot be modified here.',
          )}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('common.loading', 'Loading services...')}
        </div>
      ) : services.length === 0 ? (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '6px',
            border: '1px dashed var(--border-color)',
          }}
        >
          {t('clinicDoctors.services.noServices', 'No services available. Configure services in Clinic Settings first.')}
        </div>
      ) : filteredServices.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('common.noMatches', 'No matching services found')}
        </div>
      ) : (
        <div
          style={{
            maxHeight: '190px',
            overflowY: 'auto',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '6px 10px', width: '40px', textAlign: 'center' }}>
                  {t('common.assign', 'Assign')}
                </th>
                <th style={{ padding: '6px 10px' }}>{t('clinicDoctors.services.service', 'Service')}</th>
                <th style={{ padding: '6px 10px', width: '130px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={10} style={{ color: 'var(--text-muted)' }} />
                    <span>{t('clinicDoctors.services.basePrice', 'Base Price (Ref)')}</span>
                  </div>
                </th>
                <th style={{ padding: '6px 10px', width: '140px' }}>
                  {t('clinicDoctors.services.customPrice', 'Doctor Custom Price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service, idx) => {
                const itemState = value[service.id] || {
                  isAssigned: false,
                  customPrice: Number(service.price).toFixed(2),
                };
                const isAssigned = itemState.isAssigned;

                return (
                  <tr
                    key={service.id}
                    style={{
                      borderBottom:
                        idx === filteredServices.length - 1 ? 'none' : '1px solid var(--border-color)',
                      backgroundColor: isAssigned ? 'rgba(14, 165, 233, 0.04)' : 'transparent',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => toggleService(service.id, service.price)}
                        style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--primary-600)' }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <div
                        onClick={() => toggleService(service.id, service.price)}
                        style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-heading)' }}
                      >
                        {service.name}
                      </div>
                      {service.description && (
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '220px',
                          }}
                        >
                          {service.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          cursor: 'not-allowed',
                        }}
                        title={t('clinicDoctors.services.basePriceReadonly', 'Base price is read-only for reference')}
                      >
                        ${Number(service.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: isAssigned ? 'var(--text-heading)' : 'var(--text-muted)' }}>
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!isAssigned}
                          value={itemState.customPrice}
                          onChange={(e) => updatePrice(service.id, e.target.value)}
                          placeholder={Number(service.price).toFixed(2)}
                          style={{
                            width: '84px',
                            height: '26px',
                            padding: '2px 6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: isAssigned
                              ? '1px solid var(--primary-500, #0ea5e9)'
                              : '1px solid var(--border-color)',
                            backgroundColor: isAssigned ? 'var(--bg-card)' : 'var(--bg-secondary)',
                            color: isAssigned ? 'var(--text-heading)' : 'var(--text-muted)',
                            opacity: isAssigned ? 1 : 0.6,
                            cursor: isAssigned ? 'text' : 'not-allowed',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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

export const ClinicUsersDoctorsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const isClinicAdmin = Boolean(
    !isTenantAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'clinic admin' || lower === 'clinic-admin';
      }),
  );

  const [doctorsList, setDoctorsList] = useState<ClinicDoctorRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [availableSpecializations, setAvailableSpecializations] = useState<SpecializationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<ClinicDoctorRecord | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState<ClinicDoctorRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Services State
  const [availableServices, setAvailableServices] = useState<ClinicServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [createServices, setCreateServices] = useState<Record<string, ServicePriceItemState>>({});
  const [editServices, setEditServices] = useState<Record<string, ServicePriceItemState>>({});

  // Create Form State
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    address: '',
    specialization: '',
    qualification: '',
    colorCode: PRESET_DOCTOR_COLORS[0].hex,
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    address: '',
    specialization: '',
    qualification: '',
    colorCode: PRESET_DOCTOR_COLORS[0].hex,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const parsePhone = (rawPhone?: string) => {
    if (!rawPhone) return { code: '+52', number: '' };
    const match = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: '+52', number: rawPhone };
  };

  // Debounced search for server sync
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setLoadingServices(true);
      const [docRes, branchesRes, specsRes, servicesRes] = await Promise.allSettled([
        api.get('/clinic/users/doctors', {
          params: {
            branchId: isTenantAdmin && selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
            search: debouncedSearch.trim() || undefined,
          },
        }),
        api.get('/branches', {
          params: { moduleKey: 'CLINIC' },
        }),
        specializationService.getAll({ status: 'ACTIVE' }),
        clinicServiceService.getAll({ status: 'ACTIVE' }),
      ]);

      if (docRes.status === 'fulfilled') {
        setDoctorsList(docRes.value.data || []);
      }
      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.data || []);
      }
      if (specsRes.status === 'fulfilled') {
        setAvailableSpecializations(specsRes.value || []);
      }
      if (servicesRes.status === 'fulfilled') {
        setAvailableServices(servicesRes.value || []);
      }
    } catch (e) {
      console.error('Failed to load clinic doctors data:', e);
    } finally {
      setLoading(false);
      setLoadingServices(false);
    }
  };

  // Initial load or branch filter switch (with spinner)
  useEffect(() => {
    loadData(false);
  }, [user?.activeTenant?.id, selectedBranchFilter]);

  // Server sync when debounced search changes (background, no spinner)
  useEffect(() => {
    loadData(true);
  }, [debouncedSearch]);

  const branchFilterOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('clinicDoctors.allBranches', 'All Branches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name} ${b.code ? `(${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  // Specialization SearchableSelect options
  const baseSpecializationOptions: SearchableSelectOption[] = useMemo(() => {
    return availableSpecializations.map((s) => ({
      value: s.name,
      label: s.name,
      sublabel: s.description || undefined,
    }));
  }, [availableSpecializations]);

  const createSpecializationOptions: SearchableSelectOption[] = useMemo(() => {
    const opts = [...baseSpecializationOptions];
    if (
      createFormData.specialization &&
      !opts.some((o) => o.value === createFormData.specialization)
    ) {
      opts.unshift({
        value: createFormData.specialization,
        label: createFormData.specialization,
        sublabel: t('common.custom', 'Custom'),
      });
    }
    return opts;
  }, [baseSpecializationOptions, createFormData.specialization, t]);

  const editSpecializationOptions: SearchableSelectOption[] = useMemo(() => {
    const opts = [...baseSpecializationOptions];
    if (
      editFormData.specialization &&
      !opts.some((o) => o.value === editFormData.specialization)
    ) {
      opts.unshift({
        value: editFormData.specialization,
        label: editFormData.specialization,
        sublabel: t('common.current', 'Current'),
      });
    }
    return opts;
  }, [baseSpecializationOptions, editFormData.specialization, t]);

  // Duplicate color check memo
  const createDuplicateDoctor = useMemo(() => {
    return getDuplicateColorDoctor(createFormData.colorCode, doctorsList);
  }, [createFormData.colorCode, doctorsList]);

  const editDuplicateDoctor = useMemo(() => {
    return editingDoctor
      ? getDuplicateColorDoctor(editFormData.colorCode, doctorsList, editingDoctor.id)
      : undefined;
  }, [editFormData.colorCode, doctorsList, editingDoctor]);

  // Filtered & Paginated Doctors (Instant client-side filter)
  const filteredDoctors = useMemo(() => {
    const q = search.toLowerCase().trim();
    return doctorsList.filter((doc) => {
      const matchesBranch =
        selectedBranchFilter === 'all' || doc.branch?.id === selectedBranchFilter;
      const matchesSearch =
        !q ||
        doc.name?.toLowerCase().includes(q) ||
        doc.email?.toLowerCase().includes(q) ||
        doc.specialization?.toLowerCase().includes(q) ||
        (doc.qualification && doc.qualification.toLowerCase().includes(q)) ||
        (doc.licenseNumber && doc.licenseNumber.toLowerCase().includes(q)) ||
        (doc.phone && doc.phone.toLowerCase().includes(q)) ||
        (doc.colorCode && doc.colorCode.toLowerCase().includes(q)) ||
        (doc.branch?.name && doc.branch.name.toLowerCase().includes(q)) ||
        (doc.branch?.code && doc.branch.code.toLowerCase().includes(q));

      return matchesBranch && matchesSearch;
    });
  }, [doctorsList, selectedBranchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / pageSize));
  const paginatedDoctors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDoctors.slice(start, start + pageSize);
  }, [filteredDoctors, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchFilter]);

  // Export Doctors to CSV (6 core fields with language-based dynamic headers)
  const handleExportDoctors = () => {
    if (filteredDoctors.length === 0) {
      toast.error(t('exportDoctors.noRecordsToast', 'No doctors available to export'));
      return;
    }

    const columns: ExportColumnDef<ClinicDoctorRecord>[] = [
      {
        header: t('exportDoctors.doctorName', 'Doctor Name'),
        accessor: (doc) => doc.name || '',
      },
      {
        header: t('exportDoctors.clinicPractice', 'Clinic / Practice'),
        accessor: (doc) => doc.branch?.name || '',
      },
      {
        header: t('exportDoctors.email', 'Email'),
        accessor: (doc) => doc.email || '',
      },
      {
        header: t('exportDoctors.phone', 'Phone'),
        accessor: (doc) => doc.phone || '',
      },
      {
        header: t('exportDoctors.specialization', 'Specialization'),
        accessor: (doc) => doc.specialization || '',
      },
      {
        header: t('exportDoctors.address', 'Address'),
        accessor: (doc) => doc.address || '',
      },
    ];

    const todayStr = getTodayDateString();
    const filename = `doctors_clinic_${todayStr}`;
    const exported = exportToCSV(filename, columns, filteredDoctors);

    if (exported) {
      toast.success(
        t('exportDoctors.successToast', {
          count: filteredDoctors.length,
          defaultValue: `Exported ${filteredDoctors.length} doctor records successfully`,
        })
      );
    }
  };

  const handleOpenCreateModal = () => {
    const nextColor = findNextAvailableColor(doctorsList);
    setCreateFormData({
      name: '',
      email: '',
      phoneCountryCode: '+52',
      phoneNumber: '',
      address: '',
      specialization: availableSpecializations[0]?.name || '',
      qualification: '',
      colorCode: nextColor,
    });
    const initServices: Record<string, ServicePriceItemState> = {};
    for (const s of availableServices) {
      initServices[s.id] = {
        isAssigned: false,
        customPrice: Number(s.price).toFixed(2),
      };
    }
    setCreateServices(initServices);
    setShowCreateModal(true);
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.name.trim()) {
      toast.error(t('clinicDoctors.modal.nameRequired', 'Doctor name is required'));
      return;
    }
    if (!createFormData.email.trim()) {
      toast.error(t('clinicDoctors.modal.emailRequired', 'Email is required'));
      return;
    }

    if (createDuplicateDoctor) {
      toast.error(
        t('clinicDoctors.modal.colorDuplicate', {
          name: createDuplicateDoctor.name,
          defaultValue: `This color code is already assigned to Dr. ${createDuplicateDoctor.name}. Please select a unique color.`,
        }),
      );
      return;
    }

    const assignedServicesPayload = Object.entries(createServices)
      .filter(([_, state]) => state.isAssigned)
      .map(([serviceId, state]) => ({
        serviceId,
        customPrice: parseFloat(String(state.customPrice)) || 0,
      }));

    try {
      setSubmitting(true);
      await api.post('/clinic/users/doctors', {
        name: createFormData.name.trim(),
        email: createFormData.email.trim(),
        phoneCountryCode: createFormData.phoneCountryCode,
        phoneNumber: createFormData.phoneNumber?.trim() || undefined,
        address: createFormData.address?.trim() || undefined,
        specialization: createFormData.specialization?.trim() || undefined,
        qualification: createFormData.qualification?.trim() || undefined,
        colorCode: createFormData.colorCode?.trim() || undefined,
        services: assignedServicesPayload,
      });
      toast.success(
        t('clinicDoctors.alerts.createSuccess', {
          name: createFormData.name.startsWith('Dr.') ? createFormData.name : `Dr. ${createFormData.name}`.trim(),
          defaultValue: 'Clinic Doctor invited successfully. Welcome email dispatched.',
        }),
        t('clinicDoctors.modal.createTitle', 'Doctor Added'),
      );
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicDoctors.alerts.createFailed', 'Failed to create Doctor profile');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (doc: ClinicDoctorRecord) => {
    const { code, number } = parsePhone(doc.phone);

    setEditingDoctor(doc);
    setEditFormData({
      name: doc.name || '',
      phoneCountryCode: code,
      phoneNumber: number,
      address: doc.address || '',
      specialization: doc.specialization || '',
      qualification: doc.qualification || doc.licenseNumber || '',
      colorCode: doc.colorCode || findNextAvailableColor(doctorsList, doc.id),
      status: doc.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

    const assignedMap = new Map((doc.services || []).map((s) => [s.serviceId, s.customPrice]));
    const initEditServices: Record<string, ServicePriceItemState> = {};
    for (const s of availableServices) {
      const isAssigned = assignedMap.has(s.id);
      initEditServices[s.id] = {
        isAssigned,
        customPrice: isAssigned
          ? Number(assignedMap.get(s.id)).toFixed(2)
          : Number(s.price).toFixed(2),
      };
    }
    setEditServices(initEditServices);
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;

    if (!editFormData.name.trim()) {
      toast.error(t('clinicDoctors.modal.nameRequired', 'Doctor name is required'));
      return;
    }

    if (editDuplicateDoctor) {
      toast.error(
        t('clinicDoctors.modal.colorDuplicate', {
          name: editDuplicateDoctor.name,
          defaultValue: `This color code is already assigned to Dr. ${editDuplicateDoctor.name}. Please select a unique color.`,
        }),
      );
      return;
    }

    const assignedServicesPayload = Object.entries(editServices)
      .filter(([_, state]) => state.isAssigned)
      .map(([serviceId, state]) => ({
        serviceId,
        customPrice: parseFloat(String(state.customPrice)) || 0,
      }));

    try {
      setSubmitting(true);
      await api.patch(`/clinic/users/doctors/${editingDoctor.id}`, {
        name: editFormData.name.trim(),
        phoneCountryCode: editFormData.phoneCountryCode,
        phoneNumber: editFormData.phoneNumber?.trim() || undefined,
        address: editFormData.address?.trim() || undefined,
        specialization: editFormData.specialization?.trim() || undefined,
        qualification: editFormData.qualification?.trim() || undefined,
        colorCode: editFormData.colorCode?.trim() || undefined,
        status: editFormData.status,
        services: assignedServicesPayload,
      });
      toast.success(
        t('clinicDoctors.alerts.updateSuccess', 'Doctor profile updated successfully'),
      );
      setEditingDoctor(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicDoctors.alerts.updateFailed', 'Failed to update Doctor profile');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async (doc: ClinicDoctorRecord) => {
    try {
      setResendingId(doc.id);
      await api.post(`/clinic/users/doctors/${doc.id}/resend-invite`);
      toast.success(
        t('clinicDoctors.alerts.resendSuccess', {
          email: doc.email,
          defaultValue: `Invitation email resent to ${doc.email}`,
        }),
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicDoctors.alerts.resendFailed', 'Failed to resend invitation email');
      toast.error(msg);
    } finally {
      setResendingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoctor) return;

    try {
      setSubmitting(true);
      await api.delete(`/clinic/users/doctors/${deletingDoctor.id}`);
      toast.success(
        t('clinicDoctors.alerts.deleteSuccess', 'Doctor removed successfully'),
      );
      setDeletingDoctor(null);
      loadData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        t('clinicDoctors.alerts.deleteFailed', 'Failed to remove Doctor');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
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
              <Stethoscope size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('clinicDoctors.pageTitle', 'Clinic Doctors & Dentists')}
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {t(
              'clinicDoctors.pageSubtitle',
              'Manage attending dentists, surgeon profiles, specializations, and credentials.',
            )}
          </p>
        </div>

        {/* Action Buttons: Export & Add Doctor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportDoctors}
            disabled={loading || filteredDoctors.length === 0}
            title={t('exportDoctors.exportBtn', 'Export CSV')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: '8px',
              minHeight: '40px',
            }}
          >
            <Download size={17} />
            <span>{t('exportDoctors.exportBtn', 'Export CSV')}</span>
          </button>

          {isTenantAdmin ? (
            <Tooltip
              content={t(
                'clinicDoctors.rule1Notice',
                'Tenant Admins cannot create Doctor users. Doctors must be created by the branch Clinic Admin.',
              )}
            >
              <span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    padding: '10px 18px',
                    borderRadius: '8px',
                    opacity: 0.65,
                    cursor: 'not-allowed',
                  }}
                >
                  <ShieldAlert size={17} />
                  <span>{t('clinicDoctors.addDoctorBtn', 'Add Doctor')}</span>
                </button>
              </span>
            </Tooltip>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                padding: '10px 18px',
                borderRadius: '8px',
              }}
            >
              <Plus size={18} />
              <span>{t('clinicDoctors.addDoctorBtn', 'Add Doctor')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input"
            placeholder={t('clinicDoctors.searchPlaceholder', 'Search doctor by name, email, specialization...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%', height: '40px', fontSize: '13.5px', borderRadius: '10px' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Branch Filter or Clinic Admin's Branch */}
        {isTenantAdmin ? (
          <div style={{ width: '250px' }}>
            <SearchableSelect
              options={branchFilterOptions}
              value={selectedBranchFilter}
              onChange={(val) => setSelectedBranchFilter(val)}
              placeholder={t('clinicDoctors.filterBranch', 'Filter by Branch')}
            />
          </div>
        ) : (
          user?.availableBranches && user.availableBranches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600 }}>
              <Building2 size={15} style={{ color: 'var(--primary-600)' }} />
              <span>{user.availableBranches[0]?.name}</span>
            </div>
          )
        )}
      </div>

      {/* Doctors Table */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', width: '28%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.doctor', 'Doctor / Practitioner')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', width: '18%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.specialization', 'Specialization')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', width: '22%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.contact', 'Contact')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', width: '14%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.branch', 'Branch')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'center', width: '10%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.status', 'Status')}
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'right', width: '8%', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('clinicDoctors.table.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Clock className="animate-spin" size={18} />
                      <span>{t('common.loading', 'Loading doctors...')}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--badge-primary-bg)', color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <Users size={24} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('clinicDoctors.table.emptyTitle', 'No Clinic Doctors Found')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {isClinicAdmin
                        ? t('clinicDoctors.table.emptyAdminHelp', 'Click "+ Add Doctor" to invite your attending dental practitioners.')
                        : t('clinicDoctors.table.emptyTenantHelp', 'Doctor profiles are created and managed by the Clinic Admin of each branch.')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedDoctors.map((doc) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: doc.colorCode ? `${doc.colorCode}22` : 'var(--badge-primary-bg)',
                            color: doc.colorCode || 'var(--primary-600)',
                            border: `2px solid ${doc.colorCode || 'var(--primary-600)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '14px',
                            flexShrink: 0,
                            position: 'relative',
                          }}
                        >
                          {doc.avatarUrl ? (
                            <img
                              src={doc.avatarUrl}
                              alt={doc.name}
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            doc.name.charAt(0).toUpperCase()
                          )}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-1px',
                              right: '-1px',
                              width: '11px',
                              height: '11px',
                              borderRadius: '50%',
                              backgroundColor: doc.colorCode || '#0EA5E9',
                              border: '2px solid var(--bg-card)',
                            }}
                            title={`Calendar Color: ${doc.colorCode || '#0EA5E9'}`}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span>{doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`}</span>
                            {doc.colorCode && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  color: doc.colorCode,
                                  backgroundColor: `${doc.colorCode}18`,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  border: `1px solid ${doc.colorCode}35`,
                                }}
                                title={`Calendar Color: ${doc.colorCode}`}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: doc.colorCode }} />
                                {doc.colorCode}
                              </span>
                            )}
                            {doc.services && doc.services.length > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: 'var(--primary-600)',
                                  backgroundColor: 'var(--badge-primary-bg)',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                }}
                                title={`${doc.services.length} assigned services with custom pricing`}
                              >
                                <Briefcase size={10} />
                                {t('clinicDoctors.services.serviceCount', {
                                  count: doc.services.length,
                                  defaultValue: `${doc.services.length} ${doc.services.length === 1 ? 'service' : 'services'}`,
                                })}
                              </span>
                            )}
                          </div>
                          {doc.qualification ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {doc.qualification}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {t('clinicDoctors.badgePractitioner', 'Practitioner')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {doc.specialization ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          <Award size={13} style={{ color: 'var(--primary-600)' }} />
                          {doc.specialization}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <Mail size={13} />
                          {doc.email}
                        </span>
                        {doc.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                            <Phone size={13} />
                            {doc.phone}
                          </span>
                        )}
                        {doc.address && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }} title={doc.address}>
                            <MapPin size={13} style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                              {doc.address}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {doc.branch ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          <Building2 size={13} style={{ color: 'var(--primary-600)' }} />
                          <span>{doc.branch.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          doc.status === 'ACTIVE'
                            ? 'badge-success'
                            : doc.status === 'INVITED'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}
                      >
                        {doc.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Tooltip content={t('clinicDoctors.actions.resendInvite', 'Resend Welcome Email')}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleResendInvite(doc)}
                            disabled={resendingId === doc.id}
                            style={{ padding: '6px', borderRadius: '6px' }}
                          >
                            <Send size={14} className={resendingId === doc.id ? 'animate-spin' : ''} />
                          </button>
                        </Tooltip>

                        {(isClinicAdmin || isTenantAdmin) && (
                          <Tooltip content={t('clinicDoctors.actions.edit', 'Edit Profile')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleOpenEdit(doc)}
                              style={{ padding: '6px', borderRadius: '6px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </Tooltip>
                        )}

                        {isTenantAdmin && (
                          <Tooltip content={t('clinicDoctors.actions.delete', 'Remove Doctor')}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setDeletingDoctor(doc)}
                              style={{ padding: '6px', borderRadius: '6px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredDoctors.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            totalItems={filteredDoctors.length}
          />
        )}
      </div>

      {/* CREATE DOCTOR MODAL (Rule 2: Clinic Admin only) */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: 'min(92vh, 680px)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '13px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--badge-primary-bg)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Stethoscope size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {t('clinicDoctors.createModal.title', 'Invite Clinic Doctor')}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {t('clinicDoctors.createModal.subtitle', 'Add a dental practitioner and send an invite link')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={17} />
              </button>
            </div>

            <form
              onSubmit={handleCreateDoctor}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '10px 14px',
                }}
              >
                {/* 1. Doctor Name */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.name', 'Doctor Name')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dr. Alejandro Morales"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    required
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 2. Email Address */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.email', 'Email Address')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="dr.morales@clinic.com"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    required
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 3. Phone Number */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.phone', 'Phone Number')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={createFormData.phoneCountryCode}
                        onChange={(val) => setCreateFormData({ ...createFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="input"
                      placeholder="55 1234 5678"
                      value={createFormData.phoneNumber}
                      onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1, width: '100%', height: '36px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* 4. Specialization */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.specialization', 'Specialization')}
                  </label>
                  <SearchableSelect
                    options={createSpecializationOptions}
                    value={createFormData.specialization}
                    onChange={(val) => setCreateFormData({ ...createFormData, specialization: val })}
                    placeholder={t('clinicDoctors.modal.selectSpecialization', 'Select specialization...')}
                    searchPlaceholder={t('common.search', 'Search...')}
                  />
                  {availableSpecializations.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {t('clinicDoctors.modal.noSpecializationsConfigured', 'No active specializations configured in Clinic settings.')}
                    </div>
                  )}
                </div>

                {/* 5. Qualification */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.qualification', 'Qualification')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('clinicDoctors.modal.qualificationPlaceholder', 'e.g. DDS, DMD, Master in Orthodontics...')}
                    value={createFormData.qualification}
                    onChange={(e) => setCreateFormData({ ...createFormData, qualification: e.target.value })}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 6. Address */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.address', 'Address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Av. Insurgentes Sur 123, Col. Roma, CDMX"
                    value={createFormData.address}
                    onChange={(e) => setCreateFormData({ ...createFormData, address: e.target.value })}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 7. Doctor Calendar Color (Full Width across 2 columns) */}
                <div style={{ gridColumn: '1 / -1', paddingTop: '2px' }}>
                  <DoctorColorPicker
                    value={createFormData.colorCode}
                    onChange={(hex) => setCreateFormData({ ...createFormData, colorCode: hex })}
                    existingDoctors={doctorsList}
                  />
                </div>

                {/* 8. Doctor Services & Custom Pricing */}
                <DoctorServicesPricingSection
                  services={availableServices}
                  loading={loadingServices}
                  value={createServices}
                  onChange={setCreateServices}
                />
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '10px 20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  style={{ height: '34px', padding: '0 14px', fontSize: '13px', borderRadius: '7px' }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting || Boolean(createDuplicateDoctor)}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    fontSize: '13px',
                    borderRadius: '7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  {submitting ? (
                    <>
                      <Clock className="animate-spin" size={14} />
                      <span>{t('common.saving', 'Adding Doctor...')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{t('clinicDoctors.modal.sendInviteBtn', 'Add & Send Invite')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DOCTOR MODAL */}
      {editingDoctor && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: 'min(92vh, 680px)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '13px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--badge-primary-bg)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {t('clinicDoctors.editModal.title', 'Edit Doctor Profile')}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {t('clinicDoctors.editModal.subtitle', 'Update practitioner information and appointment calendar color')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoctor(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={17} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateDoctor}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '10px 14px',
                }}
              >
                {/* 1. Doctor Name */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.name', 'Doctor Name')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 2. Status */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.status', 'Status')}
                  </label>
                  <select
                    className="input"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  >
                    <option value="ACTIVE">{t('common.active', 'Active')}</option>
                    <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
                  </select>
                </div>

                {/* 3. Phone Number */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.phone', 'Phone Number')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={editFormData.phoneCountryCode}
                        onChange={(val) => setEditFormData({ ...editFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="input"
                      value={editFormData.phoneNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1, width: '100%', height: '36px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* 4. Specialization */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.specialization', 'Specialization')}
                  </label>
                  <SearchableSelect
                    options={editSpecializationOptions}
                    value={editFormData.specialization}
                    onChange={(val) => setEditFormData({ ...editFormData, specialization: val })}
                    placeholder={t('clinicDoctors.modal.selectSpecialization', 'Select specialization...')}
                    searchPlaceholder={t('common.search', 'Search...')}
                  />
                </div>

                {/* 5. Qualification */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.qualification', 'Qualification')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('clinicDoctors.modal.qualificationPlaceholder', 'e.g. DDS, DMD, Master in Orthodontics...')}
                    value={editFormData.qualification}
                    onChange={(e) => setEditFormData({ ...editFormData, qualification: e.target.value })}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 6. Address */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                    {t('clinicDoctors.modal.address', 'Address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* 7. Doctor Calendar Color (Full Width across 2 columns) */}
                <div style={{ gridColumn: '1 / -1', paddingTop: '2px' }}>
                  <DoctorColorPicker
                    value={editFormData.colorCode}
                    onChange={(hex) => setEditFormData({ ...editFormData, colorCode: hex })}
                    existingDoctors={doctorsList}
                    currentDoctorId={editingDoctor.id}
                  />
                </div>

                {/* 8. Doctor Services & Custom Pricing */}
                <DoctorServicesPricingSection
                  services={availableServices}
                  loading={loadingServices}
                  value={editServices}
                  onChange={setEditServices}
                />
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '10px 20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingDoctor(null)}
                  disabled={submitting}
                  style={{ height: '34px', padding: '0 14px', fontSize: '13px', borderRadius: '7px' }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting || Boolean(editDuplicateDoctor)}
                  style={{ height: '34px', padding: '0 16px', fontSize: '13px', borderRadius: '7px' }}
                >
                  {submitting ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingDoctor && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--badge-danger-bg)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('clinicDoctors.deleteModal.title', 'Remove Doctor?')}
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              {t(
                'clinicDoctors.deleteModal.confirmText',
                'Are you sure you want to remove Dr. {{name}}? This will revoke their access to the clinic branch.',
                { name: deletingDoctor.name },
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingDoctor(null)}
                disabled={submitting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? t('common.deleting', 'Removing...') : t('common.confirmDelete', 'Remove Doctor')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
