import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import {
  doctorService,
  type DoctorListItem,
  type DoctorGroupListItem,
  type DoctorGroupDetail,
} from '../../services/doctor.service';
import api from '../../services/api';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import {
  UserRound,
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  Clock,
  Layers,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  Tag,
  UserPlus,
  UserMinus,
  AlertTriangle,
} from 'lucide-react';

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

export const LabDoctorsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { toast } = useToast();

  const isLabAdmin = Boolean(
    !isTenantAdmin &&
      user?.roles?.some((r) => {
        const lower = r.toLowerCase();
        return lower === 'lab admin' || lower === 'lab-admin';
      }),
  );

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'ALL_DOCTORS' | 'DOCTOR_LISTS'>('ALL_DOCTORS');

  // Doctor Directory Data
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Doctor Modals
  const [showCreateDoctorModal, setShowCreateDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorListItem | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState<DoctorListItem | null>(null);
  const [submittingDoctor, setSubmittingDoctor] = useState(false);

  // Doctor Form State
  const [doctorFormData, setDoctorFormData] = useState({
    name: '',
    clinicName: '',
    email: '',
    phoneCountryCode: '+52',
    phoneNumber: '',
    address: '',
    specialization: '',
  });

  // Doctor Groups / Lists Data
  const [doctorLists, setDoctorLists] = useState<DoctorGroupListItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DoctorGroupListItem | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<DoctorGroupListItem | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
  });

  // Doctor selection inside Create/Edit Group Modal
  const [selectableDoctors, setSelectableDoctors] = useState<DoctorListItem[]>([]);
  const [selectedGroupDoctorIds, setSelectedGroupDoctorIds] = useState<string[]>([]);
  const [groupDoctorSearch, setGroupDoctorSearch] = useState('');

  const loadSelectableDoctors = useCallback(async () => {
    try {
      const allDocs = await doctorService.getAll({
        branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
        status: 'ACTIVE',
      });
      setSelectableDoctors(allDocs);
    } catch (err) {
      console.error(err);
    }
  }, [selectedBranchFilter]);

  const filteredGroupDoctors = useMemo(() => {
    const q = groupDoctorSearch.toLowerCase().trim();
    if (!q) return selectableDoctors;
    return selectableDoctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.clinicName && d.clinicName.toLowerCase().includes(q)) ||
        (d.specialization && d.specialization.toLowerCase().includes(q)),
    );
  }, [selectableDoctors, groupDoctorSearch]);

  const toggleDoctorSelection = (doctorId: string) => {
    setSelectedGroupDoctorIds((prev) =>
      prev.includes(doctorId) ? prev.filter((id) => id !== doctorId) : [...prev, doctorId],
    );
  };

  const handleSelectAllGroupDoctors = () => {
    const allFilteredIds = filteredGroupDoctors.map((d) => d.id);
    setSelectedGroupDoctorIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleDeselectAllGroupDoctors = () => {
    const filteredIdsSet = new Set(filteredGroupDoctors.map((d) => d.id));
    setSelectedGroupDoctorIds((prev) => prev.filter((id) => !filteredIdsSet.has(id)));
  };

  // Manage Group Members Modal
  const [managingGroup, setManagingGroup] = useState<DoctorGroupDetail | null>(null);
  const [selectedDoctorToAdd, setSelectedDoctorToAdd] = useState('');
  const [updatingMembers, setUpdatingMembers] = useState(false);

  // Fetch Branches (for Tenant Admin)
  useEffect(() => {
    if (isTenantAdmin) {
      api
        .get('/branches')
        .then((res) => {
          const labBranches = res.data.filter(
            (b: any) => b.moduleKey === 'LAB' && b.status === 'ACTIVE',
          );
          setBranches(labBranches);
        })
        .catch(() => {});
    }
  }, [isTenantAdmin]);

  // Fetch Doctors
  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await doctorService.getAll({
        branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
        status: selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
        type: selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined,
        search: search.trim() || undefined,
      });
      setDoctors(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.createFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchFilter, selectedStatusFilter, selectedTypeFilter, search, toast, t]);

  // Fetch Doctor Groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoadingLists(true);
      const data = await doctorService.getAllLists(
        selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
      );
      setDoctorLists(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLists(false);
    }
  }, [selectedBranchFilter]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    if (activeTab === 'DOCTOR_LISTS') {
      fetchGroups();
    }
  }, [activeTab, fetchGroups]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchFilter, selectedStatusFilter, selectedTypeFilter]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = doctors.length;
    const active = doctors.filter((d) => d.isActive).length;
    const local = doctors.filter((d) => d.type === 'LOCAL').length;
    const integrated = doctors.filter((d) => d.type === 'INTEGRATED').length;
    return { total, active, local, integrated };
  }, [doctors]);

  // Paginated Doctors
  const paginatedDoctors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return doctors.slice(start, start + pageSize);
  }, [doctors, currentPage, pageSize]);

  // Branch Filter Options
  const branchOptions: SearchableSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('labDoctors.filterAllBranches') },
      ...branches.map((b) => ({
        value: b.id,
        label: `${b.name}${b.code ? ` (${b.code})` : ''}`,
      })),
    ];
  }, [branches, t]);

  const statusOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: t('labDoctors.filterAllStatus') },
      { value: 'ACTIVE', label: t('labDoctors.filterStatusActive') },
      { value: 'INACTIVE', label: t('labDoctors.filterStatusInactive') },
    ],
    [t],
  );

  const typeOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: t('labDoctors.filterAllTypes') },
      { value: 'LOCAL', label: t('labDoctors.filterTypeLocal') },
      { value: 'INTEGRATED', label: t('labDoctors.filterTypeIntegrated') },
    ],
    [t],
  );

  // Doctor Form Handlers
  const handleOpenCreateDoctor = () => {
    setDoctorFormData({
      name: '',
      clinicName: '',
      email: '',
      phoneCountryCode: '+52',
      phoneNumber: '',
      address: '',
      specialization: '',
    });
    setShowCreateDoctorModal(true);
  };

  const handleOpenEditDoctor = (doctor: DoctorListItem) => {
    setEditingDoctor(doctor);
    let code = '+52';
    let rawPhone = doctor.phone || '';

    for (const item of COUNTRY_DIALING_CODES) {
      if (rawPhone.startsWith(item.value)) {
        code = item.value;
        rawPhone = rawPhone.substring(item.value.length).trim();
        break;
      }
    }

    setDoctorFormData({
      name: doctor.name,
      clinicName: doctor.clinicName || '',
      email: doctor.email || '',
      phoneCountryCode: code,
      phoneNumber: rawPhone,
      address: doctor.address || '',
      specialization: doctor.specialization || '',
    });
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorFormData.name.trim()) return;

    const fullPhone = doctorFormData.phoneNumber.trim()
      ? `${doctorFormData.phoneCountryCode} ${doctorFormData.phoneNumber.trim()}`
      : undefined;

    setSubmittingDoctor(true);
    try {
      if (editingDoctor) {
        await doctorService.update(editingDoctor.id, {
          name: doctorFormData.name.trim(),
          clinicName: doctorFormData.clinicName.trim() || undefined,
          email: doctorFormData.email.trim() || undefined,
          phone: fullPhone,
          address: doctorFormData.address.trim() || undefined,
          specialization: doctorFormData.specialization.trim() || undefined,
        });
        toast.success(t('labDoctors.alerts.updateSuccess', { name: doctorFormData.name }));
        setEditingDoctor(null);
      } else {
        await doctorService.create({
          name: doctorFormData.name.trim(),
          clinicName: doctorFormData.clinicName.trim() || undefined,
          email: doctorFormData.email.trim() || undefined,
          phone: fullPhone,
          address: doctorFormData.address.trim() || undefined,
          specialization: doctorFormData.specialization.trim() || undefined,
          type: 'LOCAL',
        });
        toast.success(t('labDoctors.alerts.createSuccess', { name: doctorFormData.name }));
        setShowCreateDoctorModal(false);
      }
      fetchDoctors();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(
        msg,
        editingDoctor
          ? t('labDoctors.alerts.updateFailed')
          : t('labDoctors.alerts.createFailed'),
      );
    } finally {
      setSubmittingDoctor(false);
    }
  };

  const handleToggleDoctorStatus = async (doctor: DoctorListItem) => {
    try {
      await doctorService.update(doctor.id, {
        isActive: !doctor.isActive,
      });
      toast.success(t('labDoctors.alerts.statusSuccess'));
      fetchDoctors();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.statusFailed'));
    }
  };

  const handleDeleteDoctor = async () => {
    if (!deletingDoctor) return;
    setSubmittingDoctor(true);
    try {
      await doctorService.delete(deletingDoctor.id);
      toast.success(t('labDoctors.alerts.deleteSuccess'));
      setDeletingDoctor(null);
      fetchDoctors();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.deleteFailed'));
    } finally {
      setSubmittingDoctor(false);
    }
  };

  // Group Handlers
  const handleOpenCreateGroup = () => {
    setGroupFormData({ name: '', description: '' });
    setSelectedGroupDoctorIds([]);
    setGroupDoctorSearch('');
    loadSelectableDoctors();
    setShowCreateGroupModal(true);
  };

  const handleOpenEditGroup = async (group: DoctorGroupListItem) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || '',
    });
    setGroupDoctorSearch('');
    loadSelectableDoctors();
    try {
      const detail = await doctorService.getListById(group.id);
      setSelectedGroupDoctorIds(detail.members.map((m) => m.doctor.id));
    } catch {
      setSelectedGroupDoctorIds([]);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormData.name.trim()) return;

    setSubmittingGroup(true);
    try {
      if (editingGroup) {
        await doctorService.updateList(editingGroup.id, {
          name: groupFormData.name.trim(),
          description: groupFormData.description.trim() || undefined,
          doctorIds: selectedGroupDoctorIds,
        });
        toast.success(t('labDoctors.alerts.updateGroupSuccess'));
        setEditingGroup(null);
      } else {
        await doctorService.createList({
          name: groupFormData.name.trim(),
          description: groupFormData.description.trim() || undefined,
          branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined,
          doctorIds: selectedGroupDoctorIds,
        });
        toast.success(t('labDoctors.alerts.createGroupSuccess', { name: groupFormData.name }));
        setShowCreateGroupModal(false);
      }
      fetchGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(
        msg,
        editingGroup
          ? t('labDoctors.alerts.updateGroupFailed')
          : t('labDoctors.alerts.createGroupFailed'),
      );
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    setSubmittingGroup(true);
    try {
      await doctorService.deleteList(deletingGroup.id);
      toast.success(t('labDoctors.alerts.deleteGroupSuccess'));
      setDeletingGroup(null);
      fetchGroups();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.deleteGroupFailed'));
    } finally {
      setSubmittingGroup(false);
    }
  };

  // Group Members Handlers
  const handleOpenManageMembers = async (group: DoctorGroupListItem) => {
    try {
      const detail = await doctorService.getListById(group.id);
      setManagingGroup(detail);
      setSelectedDoctorToAdd('');
    } catch (err: any) {
      toast.error(err.message || t('labDoctors.alerts.createFailed'));
    }
  };

  const handleAddMemberToGroup = async () => {
    if (!managingGroup || !selectedDoctorToAdd) return;
    setUpdatingMembers(true);
    try {
      const updated = await doctorService.addListMembers(managingGroup.id, [selectedDoctorToAdd]);
      setManagingGroup(updated);
      setSelectedDoctorToAdd('');
      toast.success(t('labDoctors.alerts.addMemberSuccess'));
      fetchGroups();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.addMemberFailed'));
    } finally {
      setUpdatingMembers(false);
    }
  };

  const handleRemoveMemberFromGroup = async (doctorId: string) => {
    if (!managingGroup) return;
    setUpdatingMembers(true);
    try {
      await doctorService.removeListMember(managingGroup.id, doctorId);
      setManagingGroup((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.doctor.id !== doctorId),
              _count: { members: Math.max(0, prev._count.members - 1) },
            }
          : null,
      );
      toast.success(t('labDoctors.alerts.removeMemberSuccess'));
      fetchGroups();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('labDoctors.alerts.removeMemberFailed'));
    } finally {
      setUpdatingMembers(false);
    }
  };

  // Available Doctors to Add to Group (excluding already members)
  const availableDoctorsToAdd: SearchableSelectOption[] = useMemo(() => {
    if (!managingGroup) return [];
    const memberIds = new Set(managingGroup.members.map((m) => m.doctor.id));
    return doctors
      .filter((d) => !memberIds.has(d.id))
      .map((d) => ({
        value: d.id,
        label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''} (${d.type === 'LOCAL' ? t('labDoctors.typeLocal') : t('labDoctors.typeIntegrated')})`,
      }));
  }, [doctors, managingGroup, t]);

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* ─── Header & Top Actions ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <UserRound size={22} />
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('labDoctors.pageTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '650px' }}>
            {t('labDoctors.pageDesc')}
          </p>
        </div>

        {/* Primary Action Button — LAB ADMIN ONLY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLabAdmin && activeTab === 'ALL_DOCTORS' && (
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateDoctor}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Plus size={16} />
              <span>{t('labDoctors.addDoctor')}</span>
            </button>
          )}

          {activeTab === 'DOCTOR_LISTS' && (
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateGroup}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Plus size={16} />
              <span>{t('labDoctors.createGroup')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tenant Admin notice for Doctor creation */}
      {isTenantAdmin && activeTab === 'ALL_DOCTORS' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          <span>{t('labDoctors.tenantAdminCreationNotice')}</span>
        </div>
      )}

      {/* ─── KPI Summary Cards ───────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
            }}
          >
            <UserRound size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('labDoctors.kpiTotalDoctors')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {kpiStats.total}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'var(--badge-success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--emerald-500)',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('labDoctors.kpiActiveDoctors')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {kpiStats.active}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(20, 184, 166, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0d9488',
            }}
          >
            <Tag size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('labDoctors.kpiLocalDoctors')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {kpiStats.local}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(129, 140, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <LinkIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('labDoctors.kpiIntegratedDoctors')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
              {kpiStats.integrated}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Tabs Navigation ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ALL_DOCTORS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ALL_DOCTORS' ? '2px solid var(--primary-600)' : '2px solid transparent',
            color: activeTab === 'ALL_DOCTORS' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'ALL_DOCTORS' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <UserRound size={16} />
          <span>{t('labDoctors.tabAllDoctors')}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: activeTab === 'ALL_DOCTORS' ? 'var(--badge-primary-bg)' : 'var(--bg-surface)',
              color: activeTab === 'ALL_DOCTORS' ? 'var(--primary-600)' : 'var(--text-muted)',
            }}
          >
            {doctors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DOCTOR_LISTS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'DOCTOR_LISTS' ? '2px solid var(--primary-600)' : '2px solid transparent',
            color: activeTab === 'DOCTOR_LISTS' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'DOCTOR_LISTS' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={16} />
          <span>{t('labDoctors.tabDoctorLists')}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: activeTab === 'DOCTOR_LISTS' ? 'var(--badge-primary-bg)' : 'var(--bg-surface)',
              color: activeTab === 'DOCTOR_LISTS' ? 'var(--primary-600)' : 'var(--text-muted)',
            }}
          >
            {doctorLists.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: DOCTOR DIRECTORY ──────────────────────── */}
      {activeTab === 'ALL_DOCTORS' && (
        <>
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
              {/* Live Search */}
              <div
                style={{
                  position: 'relative',
                  minWidth: '240px',
                  maxWidth: '360px',
                  flex: 1,
                }}
              >
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder={t('labDoctors.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '13px', width: '100%' }}
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
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Branch Filter (Tenant Admin Only) */}
              {isTenantAdmin && (
                <div style={{ width: '200px' }}>
                  <SearchableSelect
                    options={branchOptions}
                    value={selectedBranchFilter}
                    onChange={setSelectedBranchFilter}
                    placeholder={t('labDoctors.filterAllBranches')}
                    icon={<Building2 size={14} />}
                  />
                </div>
              )}

              {/* Status Filter */}
              <div style={{ width: '150px' }}>
                <SearchableSelect
                  options={statusOptions}
                  value={selectedStatusFilter}
                  onChange={setSelectedStatusFilter}
                  placeholder={t('labDoctors.filterAllStatus')}
                />
              </div>

              {/* Doctor Type Filter */}
              <div style={{ width: '160px' }}>
                <SearchableSelect
                  options={typeOptions}
                  value={selectedTypeFilter}
                  onChange={setSelectedTypeFilter}
                  placeholder={t('labDoctors.filterAllTypes')}
                  icon={<Tag size={14} />}
                />
              </div>
            </div>
          </div>

          {/* Doctors Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--table-border)',
                      backgroundColor: 'var(--table-th-bg)',
                    }}
                  >
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                      {t('labDoctors.colDoctor')}
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                      {t('labDoctors.colClinic')}
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                      {t('labDoctors.colType')}
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                      {t('labDoctors.colContact')}
                    </th>
                    {isTenantAdmin && (
                      <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                        {t('labDoctors.colBranch')}
                      </th>
                    )}
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)' }}>
                      {t('labDoctors.colStatus')}
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--table-th-text)', textAlign: 'right' }}>
                      {t('labDoctors.colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isTenantAdmin ? 7 : 6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <Clock className="spin" size={18} />
                          <span>{t('common.loading')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={isTenantAdmin ? 7 : 6} style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            marginBottom: '12px',
                          }}
                        >
                          <UserRound size={24} />
                        </div>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                          {t('labDoctors.emptyTitle')}
                        </h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                          {isTenantAdmin
                            ? t('labDoctors.emptyTenantAdminDesc')
                            : t('labDoctors.emptyDesc')}
                        </p>
                        {isLabAdmin && (
                          <button
                            className="btn btn-primary"
                            onClick={handleOpenCreateDoctor}
                            style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Plus size={14} />
                            <span>{t('labDoctors.emptyAction')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedDoctors.map((doc) => (
                      <tr
                        key={doc.id}
                        style={{
                          borderBottom: '1px solid var(--table-border)',
                          transition: 'background-color 0.15s ease',
                        }}
                        className="table-row-hover"
                      >
                        {/* Doctor Name & Specialization */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
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
                              {doc.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-heading)' }}>
                                {doc.name}
                              </div>
                              {doc.specialization && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {doc.specialization}
                                </div>
                              )}
                              {doc.listMembers && doc.listMembers.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                  {doc.listMembers.map((m) => (
                                    <span
                                      key={m.doctorList.id}
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-muted)',
                                      }}
                                    >
                                      {m.doctorList.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Clinic Name */}
                        <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-main)' }}>
                          {doc.clinicName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontWeight: 500 }}>{doc.clinicName}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-subtle)' }}>—</span>
                          )}
                        </td>

                        {/* Doctor Type Badge: Local vs Integrated */}
                        <td style={{ padding: '14px 18px' }}>
                          {doc.type === 'LOCAL' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(20, 184, 166, 0.12)',
                                color: '#0d9488',
                                border: '1px solid rgba(20, 184, 166, 0.25)',
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: '#0d9488',
                                }}
                              />
                              {t('labDoctors.typeLocal')}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(129, 140, 248, 0.12)',
                                color: '#6366f1',
                                border: '1px solid rgba(129, 140, 248, 0.25)',
                              }}
                            >
                              <LinkIcon size={11} />
                              {t('labDoctors.typeIntegrated')}
                            </span>
                          )}
                        </td>

                        {/* Contact Info */}
                        <td style={{ padding: '14px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {doc.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={12} style={{ color: 'var(--text-subtle)' }} />
                                <span>{doc.email}</span>
                              </div>
                            )}
                            {doc.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={12} style={{ color: 'var(--text-subtle)' }} />
                                <span>{doc.phone}</span>
                              </div>
                            )}
                            {!doc.email && !doc.phone && (
                              <span style={{ color: 'var(--text-subtle)' }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Branch (Tenant Admin view) */}
                        {isTenantAdmin && (
                          <td style={{ padding: '14px 18px', fontSize: '12px' }}>
                            {doc.branch ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                }}
                              >
                                {doc.branch.name}
                                {doc.branch.code && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                    ({doc.branch.code})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-subtle)' }}>—</span>
                            )}
                          </td>
                        )}

                        {/* Status */}
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            className={`badge ${doc.isActive ? 'badge--success' : 'badge--inactive'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor: doc.isActive ? 'var(--emerald-500)' : 'var(--text-muted)',
                              }}
                            />
                            {doc.isActive
                              ? t('labDoctors.filterStatusActive')
                              : t('labDoctors.filterStatusInactive')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Toggle Active Status */}
                            <Tooltip
                              content={
                                doc.isActive
                                  ? t('labDoctors.statusToggleActive')
                                  : t('labDoctors.statusToggleInactive')
                              }
                            >
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleToggleDoctorStatus(doc)}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: doc.isActive ? 'var(--emerald-500)' : 'var(--text-muted)',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                {doc.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              </button>
                            </Tooltip>

                            {/* Edit Doctor */}
                            <Tooltip content={t('labDoctors.editDoctor')}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleOpenEditDoctor(doc)}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--primary-600)',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                            </Tooltip>

                            {/* Delete Doctor (Tenant Admin Only) */}
                            {isTenantAdmin && (
                              <Tooltip content={t('labDoctors.deleteDoctor')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => setDeletingDoctor(doc)}
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--rose-500)',
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                  }}
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

            {/* Pagination */}
            {doctors.length > 0 && (
              <div
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--table-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(doctors.length / pageSize) || 1}
                  totalItems={doctors.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── TAB 2: DOCTOR GROUPS & LISTS ─────────────────── */}
      {activeTab === 'DOCTOR_LISTS' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {loadingLists ? (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  padding: '48px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Clock className="spin" size={18} />
                  <span>{t('common.loading')}</span>
                </div>
              </div>
            ) : doctorLists.length === 0 ? (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  padding: '48px 24px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    marginBottom: '12px',
                  }}
                >
                  <Layers size={24} />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labDoctors.emptyGroupsTitle')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labDoctors.emptyGroupsDesc')}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenCreateGroup}
                  style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>{t('labDoctors.createGroup')}</span>
                </button>
              </div>
            ) : (
              doctorLists.map((list) => (
                <div
                  key={list.id}
                  className="card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Layers size={16} />
                        </div>
                        <h3
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: 'var(--text-heading)',
                            margin: 0,
                          }}
                        >
                          {list.name}
                        </h3>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                        }}
                      >
                        {t('labDoctors.groupMembersCount', { count: list._count.members })}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        margin: 0,
                        lineHeight: 1.5,
                        minHeight: '36px',
                      }}
                    >
                      {list.description || <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                    </p>

                    {/* Member Avatars Preview */}
                    {list.members && list.members.length > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {list.members.map((m, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {m.doctor.name}
                          </span>
                        ))}
                        {list._count.members > 5 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-subtle)',
                            }}
                          >
                            +{list._count.members - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenManageMembers(list)}
                      style={{
                        fontSize: '12px',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Users size={13} />
                      <span>{t('labDoctors.manageMembers')}</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tooltip content={t('labDoctors.editGroup')}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleOpenEditGroup(list)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-600)',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                      </Tooltip>

                      <Tooltip content={t('labDoctors.deleteGroup')}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setDeletingGroup(list)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--rose-500)',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ─── MODAL: CREATE DOCTOR (LAB ADMIN ONLY) ─────────── */}
      {showCreateDoctorModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labDoctors.createModal.title')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labDoctors.createModal.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateDoctorModal(false)}
                className="btn-secondary btn-sm"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Notice that Doctor is created as Local */}
                <div
                  style={{
                    backgroundColor: 'rgba(20, 184, 166, 0.08)',
                    border: '1px solid rgba(20, 184, 166, 0.2)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#0d9488',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={16} />
                  <span>{t('labDoctors.createModal.typeLocalNotice')}</span>
                </div>

                {/* Doctor Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.nameLabel')} <span style={{ color: 'var(--rose-500)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={t('labDoctors.createModal.namePlaceholder')}
                    value={doctorFormData.name}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, name: e.target.value })}
                  />
                </div>

                {/* Clinic Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.clinicLabel')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('labDoctors.createModal.clinicPlaceholder')}
                    value={doctorFormData.clinicName}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, clinicName: e.target.value })}
                  />
                </div>

                {/* Specialization */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.specializationLabel')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('labDoctors.createModal.specializationPlaceholder')}
                    value={doctorFormData.specialization}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, specialization: e.target.value })}
                  />
                </div>

                {/* Email */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.emailLabel')}</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder={t('labDoctors.createModal.emailPlaceholder')}
                    value={doctorFormData.email}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, email: e.target.value })}
                  />
                </div>

                {/* Phone with Country Code */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.phoneLabel')}</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={doctorFormData.phoneCountryCode}
                        onChange={(val) => setDoctorFormData({ ...doctorFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder={t('labDoctors.createModal.phonePlaceholder')}
                      value={doctorFormData.phoneNumber}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.addressLabel')}</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder={t('labDoctors.createModal.addressPlaceholder')}
                    value={doctorFormData.address}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, address: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateDoctorModal(false)}
                  disabled={submittingDoctor}
                >
                  {t('labDoctors.createModal.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingDoctor || !doctorFormData.name.trim()}
                >
                  {submittingDoctor ? t('common.loading') : t('labDoctors.createModal.submitBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT DOCTOR ───────────────────────────── */}
      {editingDoctor && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labDoctors.editModal.title')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labDoctors.editModal.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoctor(null)}
                className="btn-secondary btn-sm"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Doctor Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.nameLabel')} <span style={{ color: 'var(--rose-500)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={doctorFormData.name}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, name: e.target.value })}
                  />
                </div>

                {/* Clinic Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.clinicLabel')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={doctorFormData.clinicName}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, clinicName: e.target.value })}
                  />
                </div>

                {/* Specialization */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.specializationLabel')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={doctorFormData.specialization}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, specialization: e.target.value })}
                  />
                </div>

                {/* Email */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.emailLabel')}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={doctorFormData.email}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, email: e.target.value })}
                  />
                </div>

                {/* Phone */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.phoneLabel')}</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                      <SearchableSelect
                        options={COUNTRY_DIALING_CODES}
                        value={doctorFormData.phoneCountryCode}
                        onChange={(val) => setDoctorFormData({ ...doctorFormData, phoneCountryCode: val })}
                      />
                    </div>
                    <input
                      type="tel"
                      className="form-input"
                      value={doctorFormData.phoneNumber}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, phoneNumber: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createModal.addressLabel')}</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={doctorFormData.address}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, address: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDoctor(null)}
                  disabled={submittingDoctor}
                >
                  {t('labDoctors.editModal.cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingDoctor || !doctorFormData.name.trim()}
                >
                  {submittingDoctor ? t('common.loading') : t('labDoctors.editModal.submitBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE DOCTOR ─────────────────────────── */}
      {deletingDoctor && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--rose-500)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 8px' }}>
                {t('labDoctors.deleteModal.title')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 6px', fontWeight: 600 }}>
                {t('labDoctors.deleteModal.confirm', { name: deletingDoctor.name })}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {t('labDoctors.deleteModal.warning')}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingDoctor(null)}
                disabled={submittingDoctor}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteDoctor}
                disabled={submittingDoctor}
              >
                {submittingDoctor ? t('common.loading') : t('labDoctors.deleteModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT DOCTOR GROUP ─────────────── */}
      {(showCreateGroupModal || editingGroup) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {editingGroup
                    ? t('labDoctors.editGroupModal.title')
                    : t('labDoctors.createGroupModal.title')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {editingGroup
                    ? t('labDoctors.editGroupModal.subtitle')
                    : t('labDoctors.createGroupModal.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setEditingGroup(null);
                }}
                className="btn-secondary btn-sm"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createGroupModal.nameLabel')} <span style={{ color: 'var(--rose-500)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={t('labDoctors.createGroupModal.namePlaceholder')}
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('labDoctors.createGroupModal.descLabel')}</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder={t('labDoctors.createGroupModal.descPlaceholder')}
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Select Doctors for this List */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      {t('labDoctors.createGroupModal.selectDoctorsLabel')}{' '}
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-600)', marginLeft: '4px' }}>
                        ({t('labDoctors.createGroupModal.selectedCount', { count: selectedGroupDoctorIds.length })})
                      </span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllGroupDoctors}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--primary-600)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {t('labDoctors.createGroupModal.selectAll')}
                      </button>
                      <span style={{ color: 'var(--border-color)', fontSize: '11px' }}>|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllGroupDoctors}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {t('labDoctors.createGroupModal.deselectAll')}
                      </button>
                    </div>
                  </div>

                  {/* Search Filter for Doctors */}
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('labDoctors.createGroupModal.searchDoctorsPlaceholder')}
                      value={groupDoctorSearch}
                      onChange={(e) => setGroupDoctorSearch(e.target.value)}
                      style={{ paddingLeft: '32px', fontSize: '13px', padding: '8px 12px 8px 32px' }}
                    />
                  </div>

                  {/* Scrollable list of doctors */}
                  <div
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    {filteredGroupDoctors.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {selectableDoctors.length === 0
                          ? t('labDoctors.createGroupModal.noDoctorsAvailable')
                          : t('labDoctors.createGroupModal.noDoctorsFound')}
                      </div>
                    ) : (
                      filteredGroupDoctors.map((doc) => {
                        const isSelected = selectedGroupDoctorIds.includes(doc.id);
                        return (
                          <div
                            key={doc.id}
                            onClick={() => toggleDoctorSelection(doc.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                              />
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
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  flexShrink: 0,
                                }}
                              >
                                {doc.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--text-heading)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {doc.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {doc.clinicName || doc.specialization || (doc.branch ? doc.branch.name : '')}
                                </div>
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                flexShrink: 0,
                                backgroundColor:
                                  doc.type === 'LOCAL'
                                    ? 'rgba(20, 184, 166, 0.12)'
                                    : 'rgba(129, 140, 248, 0.12)',
                                color: doc.type === 'LOCAL' ? '#0d9488' : '#6366f1',
                              }}
                            >
                              {doc.type === 'LOCAL' ? t('labDoctors.typeLocal') : t('labDoctors.typeIntegrated')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setEditingGroup(null);
                  }}
                  disabled={submittingGroup}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingGroup || !groupFormData.name.trim()}
                >
                  {submittingGroup
                    ? t('common.loading')
                    : editingGroup
                    ? t('labDoctors.editGroupModal.submitBtn')
                    : t('labDoctors.createGroupModal.submitBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE DOCTOR GROUP ─────────────────────── */}
      {deletingGroup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--rose-500)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 8px' }}>
                {t('labDoctors.deleteGroupModal.title')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 6px', fontWeight: 600 }}>
                {t('labDoctors.deleteGroupModal.confirm', { name: deletingGroup.name })}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {t('labDoctors.deleteGroupModal.warning')}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingGroup(null)}
                disabled={submittingGroup}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteGroup}
                disabled={submittingGroup}
              >
                {submittingGroup ? t('common.loading') : t('labDoctors.deleteGroupModal.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: MANAGE GROUP MEMBERS ───────────────────── */}
      {managingGroup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                  {t('labDoctors.manageMembersModal.title', { name: managingGroup.name })}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('labDoctors.manageMembersModal.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingGroup(null)}
                className="btn-secondary btn-sm"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Add Member Row */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('labDoctors.manageMembersModal.addDoctorLabel')}</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <SearchableSelect
                      options={availableDoctorsToAdd}
                      value={selectedDoctorToAdd}
                      onChange={setSelectedDoctorToAdd}
                      placeholder={t('labDoctors.manageMembersModal.selectDoctorPlaceholder')}
                      icon={<UserPlus size={14} />}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddMemberToGroup}
                    disabled={!selectedDoctorToAdd || updatingMembers}
                    style={{ flexShrink: 0, padding: '8px 14px' }}
                  >
                    <Plus size={14} />
                    <span>{t('common.create')}</span>
                  </button>
                </div>
              </div>

              {/* Current Members List */}
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '10px',
                  }}
                >
                  {t('labDoctors.manageMembersModal.currentMembers', {
                    count: managingGroup.members.length,
                  })}
                </div>

                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  {managingGroup.members.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {t('labDoctors.manageMembersModal.noMembers')}
                    </div>
                  ) : (
                    managingGroup.members.map((m) => (
                      <div
                        key={m.doctor.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--badge-primary-bg)',
                              color: 'var(--primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            {m.doctor.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                              {m.doctor.name}
                            </div>
                            {m.doctor.clinicName && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {m.doctor.clinicName}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                m.doctor.type === 'LOCAL'
                                  ? 'rgba(20, 184, 166, 0.12)'
                                  : 'rgba(129, 140, 248, 0.12)',
                              color: m.doctor.type === 'LOCAL' ? '#0d9488' : '#6366f1',
                            }}
                          >
                            {m.doctor.type === 'LOCAL'
                              ? t('labDoctors.typeLocal')
                              : t('labDoctors.typeIntegrated')}
                          </span>

                          <Tooltip content={t('labDoctors.manageMembersModal.removeDoctor')}>
                            <button
                              type="button"
                              onClick={() => handleRemoveMemberFromGroup(m.doctor.id)}
                              disabled={updatingMembers}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--rose-500)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <UserMinus size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setManagingGroup(null)}
              >
                {t('labDoctors.manageMembersModal.doneBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
