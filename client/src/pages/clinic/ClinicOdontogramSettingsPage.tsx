import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Building2,
  AlertCircle,
  Loader2,
  Save,
  Check,
  X,
  Layers,
  Activity,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { ToothIcon } from '../../components/common/ToothIcon';
import { Pagination } from '../../components/common/Pagination';
import {
  clinicOdontogramService,
  TeethModel,
  OdontogramTreatmentItem,
  OdontogramDiagnosticItem,
  CreateOdontogramTreatmentPayload,
  CreateOdontogramDiagnosticPayload,
} from '../../services/clinicOdontogramService';

type ActiveTab = 'DEFAULT' | 'TREATMENTS' | 'DIAGNOSTICS';

const COLOR_PRESETS = [
  '#3B82F6', // Dental Blue
  '#10B981', // Mint Emerald
  '#EF4444', // Caries Red
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Amalgam Purple
  '#EC4899', // Gingival Pink
  '#06B6D4', // Sky Cyan
  '#14B8A6', // Soft Teal
  '#6366F1', // Royal Indigo
  '#F97316', // Coral Orange
];

export const ClinicOdontogramSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin, isClinicAdmin } = useAuth();
  const { toast } = useToast();

  const isSuperAdmin = user?.isSuperAdmin;
  const canAddEdit = isClinicAdmin || isTenantAdmin || isSuperAdmin;
  const canDelete = isTenantAdmin || isSuperAdmin;

  const [activeTab, setActiveTab] = useState<ActiveTab>('DEFAULT');
  const [loading, setLoading] = useState(true);

  // Clinic Branches for Tenant Admin filter
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Tab 1: Default Teeth Model
  const [defaultTeethModel, setDefaultTeethModel] = useState<TeethModel>('ADULT');
  const [savingConfig, setSavingConfig] = useState(false);

  // Tab 2: Treatments
  const [treatments, setTreatments] = useState<OdontogramTreatmentItem[]>([]);
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [treatmentPage, setTreatmentPage] = useState(1);
  const [treatmentPageSize, setTreatmentPageSize] = useState(10);
  const [showCreateTreatmentModal, setShowCreateTreatmentModal] = useState(false);
  const [showEditTreatmentModal, setShowEditTreatmentModal] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<OdontogramTreatmentItem | null>(null);
  const [treatmentForm, setTreatmentForm] = useState<CreateOdontogramTreatmentPayload>({
    name: '',
    description: '',
    color: '#3B82F6',
    appliesToWholeTooth: false,
    branchId: '',
  });
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [showDeleteTreatmentModal, setShowDeleteTreatmentModal] = useState(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState<OdontogramTreatmentItem | null>(null);
  const [deletingTreatment, setDeletingTreatment] = useState(false);

  // Tab 3: Diagnostics
  const [diagnostics, setDiagnostics] = useState<OdontogramDiagnosticItem[]>([]);
  const [diagnosticSearch, setDiagnosticSearch] = useState('');
  const [diagnosticPage, setDiagnosticPage] = useState(1);
  const [diagnosticPageSize, setDiagnosticPageSize] = useState(10);
  const [showCreateDiagnosticModal, setShowCreateDiagnosticModal] = useState(false);
  const [showEditDiagnosticModal, setShowEditDiagnosticModal] = useState(false);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<OdontogramDiagnosticItem | null>(null);
  const [diagnosticForm, setDiagnosticForm] = useState<CreateOdontogramDiagnosticPayload>({
    name: '',
    description: '',
    color: '#EF4444',
    appliesToWholeTooth: false,
    branchId: '',
  });
  const [savingDiagnostic, setSavingDiagnostic] = useState(false);
  const [showDeleteDiagnosticModal, setShowDeleteDiagnosticModal] = useState(false);
  const [diagnosticToDelete, setDiagnosticToDelete] = useState<OdontogramDiagnosticItem | null>(null);
  const [deletingDiagnostic, setDeletingDiagnostic] = useState(false);

  // Active branch context
  const branchContext = useMemo(() => {
    if (!isTenantAdmin && !isSuperAdmin) {
      return user?.activeBranchId || undefined;
    }
    return selectedBranch !== 'ALL' ? selectedBranch : undefined;
  }, [isTenantAdmin, isSuperAdmin, user?.activeBranchId, selectedBranch]);

  // Load Clinic Branches (filtered by moduleKey=CLINIC)
  useEffect(() => {
    const fetchClinicBranches = async () => {
      try {
        const res = await api.get('/branches', { params: { moduleKey: 'CLINIC' } });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const activeBranches = list.filter((b: any) => b.status === 'ACTIVE' || b.isActive);
        setBranches(activeBranches);
      } catch (err) {
        console.error('Failed to load clinic branches', err);
      }
    };

    if (isTenantAdmin || isSuperAdmin) {
      fetchClinicBranches();
    }
  }, [isTenantAdmin, isSuperAdmin]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configData, treatmentsData, diagnosticsData] = await Promise.all([
        clinicOdontogramService.getConfig(branchContext),
        clinicOdontogramService.getTreatments(branchContext),
        clinicOdontogramService.getDiagnostics(branchContext),
      ]);

      setDefaultTeethModel(configData?.defaultTeethModel || 'ADULT');
      setTreatments(treatmentsData || []);
      setDiagnostics(diagnosticsData || []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogramSettings.failedLoad', 'Failed to load odontogram settings')
      );
    } finally {
      setLoading(false);
    }
  }, [branchContext, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination on search or branch change
  useEffect(() => {
    setTreatmentPage(1);
  }, [treatmentSearch, selectedBranch]);

  useEffect(() => {
    setDiagnosticPage(1);
  }, [diagnosticSearch, selectedBranch]);

  // ─── Tab 1: Default Teeth Model Actions ─────────────────
  const handleSaveDefaultModel = async () => {
    if (!canAddEdit) return;
    try {
      setSavingConfig(true);
      await clinicOdontogramService.updateConfig({
        defaultTeethModel,
        branchId: branchContext,
      });
      toast.success(
        t('odontogramSettings.defaultTab.saveSuccess', 'Default teeth model updated successfully')
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('odontogramSettings.defaultTab.saveFailed', 'Failed to update default teeth model')
      );
    } finally {
      setSavingConfig(false);
    }
  };

  // ─── Tab 2: Treatments Actions ──────────────────────────
  const openCreateTreatment = () => {
    setTreatmentForm({
      name: '',
      description: '',
      color: '#3B82F6',
      appliesToWholeTooth: false,
      branchId: !isTenantAdmin && !isSuperAdmin ? user?.activeBranchId || '' : selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || '',
    });
    setShowCreateTreatmentModal(true);
  };

  const openEditTreatment = (item: OdontogramTreatmentItem) => {
    setSelectedTreatment(item);
    setTreatmentForm({
      name: item.name,
      description: item.description || '',
      color: item.color,
      appliesToWholeTooth: item.appliesToWholeTooth,
      branchId: item.branchId || '',
    });
    setShowEditTreatmentModal(true);
  };

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentForm.name.trim()) {
      toast.error(t('common.requiredField', 'Please fill in all required fields'));
      return;
    }
    try {
      setSavingTreatment(true);
      await clinicOdontogramService.createTreatment(treatmentForm);
      toast.success(t('odontogramSettings.treatmentsTab.createSuccess', 'Treatment created successfully'));
      setShowCreateTreatmentModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.createFailed', 'Failed to create treatment');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleUpdateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTreatment || !treatmentForm.name.trim()) {
      toast.error(t('common.requiredField', 'Please fill in all required fields'));
      return;
    }
    try {
      setSavingTreatment(true);
      await clinicOdontogramService.updateTreatment(selectedTreatment.id, {
        name: treatmentForm.name,
        description: treatmentForm.description,
        color: treatmentForm.color,
        appliesToWholeTooth: treatmentForm.appliesToWholeTooth,
      });
      toast.success(t('odontogramSettings.treatmentsTab.updateSuccess', 'Treatment updated successfully'));
      setShowEditTreatmentModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.updateFailed', 'Failed to update treatment');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleDeleteTreatment = async () => {
    if (!treatmentToDelete) return;
    try {
      setDeletingTreatment(true);
      await clinicOdontogramService.deleteTreatment(treatmentToDelete.id);
      toast.success(t('odontogramSettings.treatmentsTab.deleteSuccess', 'Treatment deleted successfully'));
      setShowDeleteTreatmentModal(false);
      setTreatmentToDelete(null);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.treatmentsTab.deleteFailed', 'Failed to delete treatment');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setDeletingTreatment(false);
    }
  };

  // ─── Tab 3: Diagnostics Actions ─────────────────────────
  const openCreateDiagnostic = () => {
    setDiagnosticForm({
      name: '',
      description: '',
      color: '#EF4444',
      appliesToWholeTooth: false,
      branchId: !isTenantAdmin && !isSuperAdmin ? user?.activeBranchId || '' : selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || '',
    });
    setShowCreateDiagnosticModal(true);
  };

  const openEditDiagnostic = (item: OdontogramDiagnosticItem) => {
    setSelectedDiagnostic(item);
    setDiagnosticForm({
      name: item.name,
      description: item.description || '',
      color: item.color,
      appliesToWholeTooth: item.appliesToWholeTooth,
      branchId: item.branchId || '',
    });
    setShowEditDiagnosticModal(true);
  };

  const handleCreateDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticForm.name.trim()) {
      toast.error(t('common.requiredField', 'Please fill in all required fields'));
      return;
    }
    try {
      setSavingDiagnostic(true);
      await clinicOdontogramService.createDiagnostic(diagnosticForm);
      toast.success(t('odontogramSettings.diagnosticsTab.createSuccess', 'Diagnostic created successfully'));
      setShowCreateDiagnosticModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.createFailed', 'Failed to create diagnostic');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingDiagnostic(false);
    }
  };

  const handleUpdateDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagnostic || !diagnosticForm.name.trim()) {
      toast.error(t('common.requiredField', 'Please fill in all required fields'));
      return;
    }
    try {
      setSavingDiagnostic(true);
      await clinicOdontogramService.updateDiagnostic(selectedDiagnostic.id, {
        name: diagnosticForm.name,
        description: diagnosticForm.description,
        color: diagnosticForm.color,
        appliesToWholeTooth: diagnosticForm.appliesToWholeTooth,
      });
      toast.success(t('odontogramSettings.diagnosticsTab.updateSuccess', 'Diagnostic updated successfully'));
      setShowEditDiagnosticModal(false);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.updateFailed', 'Failed to update diagnostic');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingDiagnostic(false);
    }
  };

  const handleDeleteDiagnostic = async () => {
    if (!diagnosticToDelete) return;
    try {
      setDeletingDiagnostic(true);
      await clinicOdontogramService.deleteDiagnostic(diagnosticToDelete.id);
      toast.success(t('odontogramSettings.diagnosticsTab.deleteSuccess', 'Diagnostic deleted successfully'));
      setShowDeleteDiagnosticModal(false);
      setDiagnosticToDelete(null);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('odontogramSettings.diagnosticsTab.deleteFailed', 'Failed to delete diagnostic');
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setDeletingDiagnostic(false);
    }
  };

  // ─── Filtered & Paginated Data ──────────────────────────
  const filteredTreatments = useMemo(() => {
    return treatments.filter((tItem) => {
      if (treatmentSearch.trim()) {
        const q = treatmentSearch.toLowerCase();
        return (
          tItem.name.toLowerCase().includes(q) ||
          (tItem.description && tItem.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [treatments, treatmentSearch]);

  const totalTreatmentPages = Math.max(1, Math.ceil(filteredTreatments.length / treatmentPageSize));
  const paginatedTreatments = useMemo(() => {
    const start = (treatmentPage - 1) * treatmentPageSize;
    return filteredTreatments.slice(start, start + treatmentPageSize);
  }, [filteredTreatments, treatmentPage, treatmentPageSize]);

  const filteredDiagnostics = useMemo(() => {
    return diagnostics.filter((dItem) => {
      if (diagnosticSearch.trim()) {
        const q = diagnosticSearch.toLowerCase();
        return (
          dItem.name.toLowerCase().includes(q) ||
          (dItem.description && dItem.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [diagnostics, diagnosticSearch]);

  const totalDiagnosticPages = Math.max(1, Math.ceil(filteredDiagnostics.length / diagnosticPageSize));
  const paginatedDiagnostics = useMemo(() => {
    const start = (diagnosticPage - 1) * diagnosticPageSize;
    return filteredDiagnostics.slice(start, start + diagnosticPageSize);
  }, [filteredDiagnostics, diagnosticPage, diagnosticPageSize]);

  const activeBranchName =
    user?.availableBranches?.find((b) => b.id === user?.activeBranchId)?.name ||
    branches.find((b) => b.id === user?.activeBranchId)?.name ||
    t('common.defaultBranch', 'Default Branch');

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* ─── Page Header ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(20, 184, 166, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600, #0d9488)',
            }}
          >
            <ToothIcon size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-heading)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('odontogramSettings.title', 'Odontogram Settings')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t(
                'odontogramSettings.subtitle',
                'Configure default teeth models, treatment options, and diagnostic entries per branch'
              )}
            </p>
          </div>
        </div>

        {/* Branch Context Display / Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!isTenantAdmin && !isSuperAdmin && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Building2 size={16} style={{ color: 'var(--primary-500, #14b8a6)' }} />
              <span>{activeBranchName}</span>
            </div>
          )}

          {(isTenantAdmin || isSuperAdmin) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-input"
                style={{
                  minWidth: '200px',
                  height: '38px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-md)',
                }}
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="ALL">{t('odontogramSettings.allBranches', 'All Branches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Role Notice Banner for Tenant Admin */}
      {(isTenantAdmin || isSuperAdmin) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            color: 'var(--text-main)',
            fontSize: '13px',
          }}
        >
          <Info size={18} style={{ color: '#0284c7', flexShrink: 0 }} />
          <span>
            {t(
              'odontogramSettings.treatmentsTab.ownerOnlyDelete',
              'As a Tenant Admin, you can review, configure, and delete treatments and diagnostics across clinic branches.'
            )}
          </span>
        </div>
      )}

      {/* ─── Tabs Navigation ─── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '20px',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          className={`btn ${activeTab === 'DEFAULT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('DEFAULT')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px',
            height: '38px',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <ToothIcon size={16} />
          <span>{t('odontogramSettings.tabs.default', 'Default')}</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'TREATMENTS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('TREATMENTS')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px',
            height: '38px',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Layers size={16} />
          <span>{t('odontogramSettings.tabs.treatments', 'Odontogram Treatment')}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'TREATMENTS' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)',
              color: activeTab === 'TREATMENTS' ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            {treatments.length}
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'DIAGNOSTICS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('DIAGNOSTICS')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px',
            height: '38px',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Activity size={16} />
          <span>{t('odontogramSettings.tabs.diagnostics', 'Odontogram Diagnostics')}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '100px',
              backgroundColor: activeTab === 'DIAGNOSTICS' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)',
              color: activeTab === 'DIAGNOSTICS' ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            {diagnostics.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <Loader2 size={36} className="spinner" style={{ color: 'var(--primary-600, #0d9488)' }} />
        </div>
      ) : (
        <>
          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 1: DEFAULT TEETH MODEL                        */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'DEFAULT' && (
            <div
              className="card"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '28px',
                maxWidth: '820px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)' }}>
                  {t('odontogramSettings.defaultTab.title', 'Default Teeth Model')}
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)' }}>
                  {t(
                    'odontogramSettings.defaultTab.subtitle',
                    'Choose whether the odontogram defaults to the Adult (permanent) or Child (pediatric) teeth model'
                  )}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginBottom: '28px',
                }}
              >
                {/* Adult Model Card */}
                <div
                  onClick={() => canAddEdit && setDefaultTeethModel('ADULT')}
                  style={{
                    border: `2px solid ${defaultTeethModel === 'ADULT' ? 'var(--primary-500, #14b8a6)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    backgroundColor: defaultTeethModel === 'ADULT' ? 'rgba(20, 184, 166, 0.06)' : 'var(--bg-surface)',
                    cursor: canAddEdit ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: defaultTeethModel === 'ADULT' ? '0 4px 16px rgba(20, 184, 166, 0.15)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(20, 184, 166, 0.14)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary-600, #0d9488)',
                        }}
                      >
                        <ToothIcon size={24} />
                      </div>
                      {defaultTeethModel === 'ADULT' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '100px',
                            backgroundColor: 'var(--badge-primary-bg, #ccfbf1)',
                            color: 'var(--badge-primary-text, #0f766e)',
                          }}
                        >
                          <Check size={13} />
                          {t('odontogramSettings.defaultTab.currentlySelected', 'Currently Active')}
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('odontogramSettings.defaultTab.adultTitle', 'Adult Model (32 Teeth)')}
                    </h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      {t(
                        'odontogramSettings.defaultTab.adultDescription',
                        'Standard permanent dentition with quadrants 1 to 4 and 32 teeth (11-48)'
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 9px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--border-subtle)', color: 'var(--text-main)' }}>
                      {t('odontogramSettings.defaultTab.quadrantsAdult', 'Quadrants 1 - 4')}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 9px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--border-subtle)', color: 'var(--text-main)' }}>
                      {t('odontogramSettings.defaultTab.teethCountAdult', 'Teeth 11 - 48 (32 Teeth)')}
                    </span>
                  </div>
                </div>

                {/* Child Model Card */}
                <div
                  onClick={() => canAddEdit && setDefaultTeethModel('CHILD')}
                  style={{
                    border: `2px solid ${defaultTeethModel === 'CHILD' ? 'var(--primary-500, #14b8a6)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    backgroundColor: defaultTeethModel === 'CHILD' ? 'rgba(20, 184, 166, 0.06)' : 'var(--bg-surface)',
                    cursor: canAddEdit ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: defaultTeethModel === 'CHILD' ? '0 4px 16px rgba(20, 184, 166, 0.15)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(16, 185, 129, 0.14)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#10b981',
                        }}
                      >
                        <ToothIcon size={24} />
                      </div>
                      {defaultTeethModel === 'CHILD' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '100px',
                            backgroundColor: 'var(--badge-success-bg, #dcfce7)',
                            color: 'var(--badge-success-text, #15803d)',
                          }}
                        >
                          <Check size={13} />
                          {t('odontogramSettings.defaultTab.currentlySelected', 'Currently Active')}
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('odontogramSettings.defaultTab.childTitle', 'Child Model (20 Teeth)')}
                    </h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      {t(
                        'odontogramSettings.defaultTab.childDescription',
                        'Pediatric primary/deciduous dentition with quadrants 5 to 8 and 20 teeth (51-85)'
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 9px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--border-subtle)', color: 'var(--text-main)' }}>
                      {t('odontogramSettings.defaultTab.quadrantsChild', 'Quadrants 5 - 8')}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 9px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--border-subtle)', color: 'var(--text-main)' }}>
                      {t('odontogramSettings.defaultTab.teethCountChild', 'Teeth 51 - 85 (20 Teeth)')}
                    </span>
                  </div>
                </div>
              </div>

              {canAddEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveDefaultModel}
                    disabled={savingConfig}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      height: '40px',
                      padding: '0 20px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 size={16} className="spinner" />
                        <span>{t('odontogramSettings.defaultTab.saving', 'Saving...')}</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>{t('odontogramSettings.defaultTab.saveButton', 'Save Default Model')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 2: ODONTOGRAM TREATMENT                       */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'TREATMENTS' && (
            <div>
              {/* Filter Toolbar */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  marginBottom: '20px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
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
                    className="form-input"
                    style={{
                      paddingLeft: '36px',
                      paddingRight: treatmentSearch ? '32px' : '12px',
                      height: '38px',
                      fontSize: '13px',
                      width: '100%',
                      borderRadius: 'var(--radius-md)',
                    }}
                    placeholder={t(
                      'odontogramSettings.treatmentsTab.searchPlaceholder',
                      'Search treatments by name or description...'
                    )}
                    value={treatmentSearch}
                    onChange={(e) => setTreatmentSearch(e.target.value)}
                  />
                  {treatmentSearch && (
                    <button
                      type="button"
                      onClick={() => setTreatmentSearch('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {canAddEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openCreateTreatment}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '38px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <Plus size={16} />
                    <span>{t('odontogramSettings.treatmentsTab.addTreatment', 'Add Treatment')}</span>
                  </button>
                )}
              </div>

              {/* Treatments Table */}
              {filteredTreatments.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: '48px 24px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Layers size={44} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 12px auto' }} />
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {t('odontogramSettings.treatmentsTab.emptyTitle', 'No treatments configured')}
                  </h4>
                  <p style={{ margin: '0 auto', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px' }}>
                    {t(
                      'odontogramSettings.treatmentsTab.emptySubtitle',
                      'Add treatment entries such as Fillings, Crowns, Inlays, or Extractions to begin.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '130px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.treatmentsTab.color', 'Color')}
                          </th>
                          <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.treatmentsTab.name', 'Treatment Name')}
                          </th>
                          <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.treatmentsTab.description', 'Description')}
                          </th>
                          <th style={{ width: '180px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.treatmentsTab.appliesTo', 'Scope')}
                          </th>
                          {(isTenantAdmin || isSuperAdmin) && (
                            <th style={{ width: '160px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                              {t('odontogramSettings.treatmentsTab.branch', 'Branch')}
                            </th>
                          )}
                          <th style={{ width: '100px', textAlign: 'right', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.treatmentsTab.actions', 'Actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTreatments.map((item) => (
                          <tr key={item.id} className="table-row-hover">
                            <td style={{ padding: '14px 18px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: item.color,
                                    boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                                    flexShrink: 0,
                                  }}
                                />
                                <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {item.color.toUpperCase()}
                                </code>
                              </div>
                            </td>
                            <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {item.name}
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                              {item.description || '—'}
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              {item.appliesToWholeTooth ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--badge-success-bg, #dcfce7)',
                                    color: 'var(--badge-success-text, #15803d)',
                                  }}
                                >
                                  <ShieldCheck size={13} />
                                  {t('odontogramSettings.treatmentsTab.wholeToothBadge', 'Whole Tooth')}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--border-subtle)',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {t('odontogramSettings.treatmentsTab.surfaceBadge', 'Surfaces')}
                                </span>
                              )}
                            </td>
                            {(isTenantAdmin || isSuperAdmin) && (
                              <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                                {item.branch?.name || t('odontogramSettings.allBranches', 'All Branches')}
                              </td>
                            )}
                            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                {canAddEdit && (
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => openEditTreatment(item)}
                                    title={t('common.edit', 'Edit')}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--text-muted)',
                                      padding: '6px',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="btn-icon btn-icon-danger"
                                    onClick={() => {
                                      setTreatmentToDelete(item);
                                      setShowDeleteTreatmentModal(true);
                                    }}
                                    title={t('common.delete', 'Delete')}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--rose-500, #f43f5e)',
                                      padding: '6px',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rule 11: Mandatory Table Pagination */}
                  <Pagination
                    currentPage={treatmentPage}
                    totalPages={totalTreatmentPages}
                    pageSize={treatmentPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onPageChange={setTreatmentPage}
                    onPageSizeChange={(sz) => {
                      setTreatmentPageSize(sz);
                      setTreatmentPage(1);
                    }}
                    totalItems={filteredTreatments.length}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════ */}
          {/* TAB 3: ODONTOGRAM DIAGNOSTICS                     */}
          {/* ═════════════════════════════════════════════════ */}
          {activeTab === 'DIAGNOSTICS' && (
            <div>
              {/* Filter Toolbar */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  marginBottom: '20px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
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
                    className="form-input"
                    style={{
                      paddingLeft: '36px',
                      paddingRight: diagnosticSearch ? '32px' : '12px',
                      height: '38px',
                      fontSize: '13px',
                      width: '100%',
                      borderRadius: 'var(--radius-md)',
                    }}
                    placeholder={t(
                      'odontogramSettings.diagnosticsTab.searchPlaceholder',
                      'Search diagnostics by name or description...'
                    )}
                    value={diagnosticSearch}
                    onChange={(e) => setDiagnosticSearch(e.target.value)}
                  />
                  {diagnosticSearch && (
                    <button
                      type="button"
                      onClick={() => setDiagnosticSearch('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {canAddEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openCreateDiagnostic}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '38px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <Plus size={16} />
                    <span>{t('odontogramSettings.diagnosticsTab.addDiagnostic', 'Add Diagnostic')}</span>
                  </button>
                )}
              </div>

              {/* Diagnostics Table */}
              {filteredDiagnostics.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: '48px 24px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Activity size={44} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 12px auto' }} />
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {t('odontogramSettings.diagnosticsTab.emptyTitle', 'No diagnostics configured')}
                  </h4>
                  <p style={{ margin: '0 auto', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px' }}>
                    {t(
                      'odontogramSettings.diagnosticsTab.emptySubtitle',
                      'Add diagnostic entries such as Caries, Fracture, Missing Tooth, or Plaque to begin.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '130px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.diagnosticsTab.color', 'Color')}
                          </th>
                          <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.diagnosticsTab.name', 'Diagnostic Name')}
                          </th>
                          <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.diagnosticsTab.description', 'Description')}
                          </th>
                          <th style={{ width: '180px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.diagnosticsTab.appliesTo', 'Scope')}
                          </th>
                          {(isTenantAdmin || isSuperAdmin) && (
                            <th style={{ width: '160px', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                              {t('odontogramSettings.diagnosticsTab.branch', 'Branch')}
                            </th>
                          )}
                          <th style={{ width: '100px', textAlign: 'right', padding: '14px 18px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px' }}>
                            {t('odontogramSettings.diagnosticsTab.actions', 'Actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDiagnostics.map((item) => (
                          <tr key={item.id} className="table-row-hover">
                            <td style={{ padding: '14px 18px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: item.color,
                                    boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                                    flexShrink: 0,
                                  }}
                                />
                                <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {item.color.toUpperCase()}
                                </code>
                              </div>
                            </td>
                            <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {item.name}
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                              {item.description || '—'}
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              {item.appliesToWholeTooth ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--badge-success-bg, #dcfce7)',
                                    color: 'var(--badge-success-text, #15803d)',
                                  }}
                                >
                                  <ShieldCheck size={13} />
                                  {t('odontogramSettings.diagnosticsTab.wholeToothBadge', 'Whole Tooth')}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--border-subtle)',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {t('odontogramSettings.diagnosticsTab.surfaceBadge', 'Surfaces')}
                                </span>
                              )}
                            </td>
                            {(isTenantAdmin || isSuperAdmin) && (
                              <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                                {item.branch?.name || t('odontogramSettings.allBranches', 'All Branches')}
                              </td>
                            )}
                            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                {canAddEdit && (
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => openEditDiagnostic(item)}
                                    title={t('common.edit', 'Edit')}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--text-muted)',
                                      padding: '6px',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="btn-icon btn-icon-danger"
                                    onClick={() => {
                                      setDiagnosticToDelete(item);
                                      setShowDeleteDiagnosticModal(true);
                                    }}
                                    title={t('common.delete', 'Delete')}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--rose-500, #f43f5e)',
                                      padding: '6px',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rule 11: Mandatory Table Pagination */}
                  <Pagination
                    currentPage={diagnosticPage}
                    totalPages={totalDiagnosticPages}
                    pageSize={diagnosticPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onPageChange={setDiagnosticPage}
                    onPageSizeChange={(sz) => {
                      setDiagnosticPageSize(sz);
                      setDiagnosticPage(1);
                    }}
                    totalItems={filteredDiagnostics.length}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT TREATMENT                           */}
      {/* ═════════════════════════════════════════════════ */}
      {(showCreateTreatmentModal || showEditTreatmentModal) && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => {
            if (!savingTreatment) {
              setShowCreateTreatmentModal(false);
              setShowEditTreatmentModal(false);
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {showCreateTreatmentModal
                    ? t('odontogramSettings.treatmentsTab.addModalTitle', 'Add Odontogram Treatment')
                    : t('odontogramSettings.treatmentsTab.editModalTitle', 'Edit Odontogram Treatment')}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  {showCreateTreatmentModal
                    ? t('odontogramSettings.treatmentsTab.subtitle', 'Configure clinical and restorative treatment option')
                    : selectedTreatment?.name}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowCreateTreatmentModal(false);
                  setShowEditTreatmentModal(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={showCreateTreatmentModal ? handleCreateTreatment : handleUpdateTreatment}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Branch Selection (for Tenant Admin in Create Mode) */}
                {showCreateTreatmentModal && (isTenantAdmin || isSuperAdmin) && branches.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('odontogramSettings.treatmentsTab.branch', 'Clinic Branch')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={treatmentForm.branchId}
                      onChange={(e) => setTreatmentForm({ ...treatmentForm, branchId: e.target.value })}
                      required
                      style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.treatmentsTab.name', 'Treatment Name')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t(
                      'odontogramSettings.treatmentsTab.namePlaceholder',
                      'e.g. Composite Restoration, Crown, Root Canal'
                    )}
                    value={treatmentForm.name}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })}
                    required
                    style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.treatmentsTab.description', 'Description')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t(
                      'odontogramSettings.treatmentsTab.descPlaceholder',
                      'Optional clinical notes or instructions'
                    )}
                    value={treatmentForm.description || ''}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', minHeight: '72px' }}
                  />
                </div>

                {/* Color Picker with modern styling */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.treatmentsTab.color', 'Color')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                      <input
                        type="color"
                        value={treatmentForm.color}
                        onChange={(e) =>
                          setTreatmentForm({ ...treatmentForm, color: e.target.value.toUpperCase() })
                        }
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: treatmentForm.color,
                          border: '2px solid var(--border-color)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={treatmentForm.color}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          setTreatmentForm({ ...treatmentForm, color: val.toUpperCase() });
                        }}
                        placeholder="#3B82F6"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        maxLength={7}
                        required
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          height: '36px',
                          fontSize: '13px',
                          width: '100%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Preset Swatches Palette */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      {t('odontogramSettings.quickPresets', 'Quick Presets')}:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((color) => {
                        const isSelected = treatmentForm.color.toUpperCase() === color.toUpperCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setTreatmentForm({ ...treatmentForm, color })}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              border: isSelected ? '2px solid var(--text-heading)' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: isSelected ? 'scale(1.15)' : 'none',
                              boxShadow: isSelected ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                            title={color}
                          >
                            {isSelected && <Check size={14} style={{ color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Applies to Whole Tooth */}
                <div
                  onClick={() =>
                    setTreatmentForm({
                      ...treatmentForm,
                      appliesToWholeTooth: !treatmentForm.appliesToWholeTooth,
                    })
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    backgroundColor: treatmentForm.appliesToWholeTooth ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-app)',
                    border: `1.5px solid ${treatmentForm.appliesToWholeTooth ? 'var(--primary-500, #14b8a6)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    id="treatmentAppliesWhole"
                    checked={treatmentForm.appliesToWholeTooth}
                    onChange={(e) =>
                      setTreatmentForm({ ...treatmentForm, appliesToWholeTooth: e.target.checked })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '2px',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--primary-500, #14b8a6)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, display: 'block', color: 'var(--text-heading)', fontSize: '13px' }}>
                      {t('odontogramSettings.treatmentsTab.appliesToWholeTooth', 'Applies to Whole Tooth')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', display: 'block', marginTop: '3px', lineHeight: 1.45 }}>
                      {t(
                        'odontogramSettings.treatmentsTab.appliesHelp',
                        'When checked, applying this treatment covers the entire tooth structure rather than individual surfaces.'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  backgroundColor: 'var(--bg-modal-footer, #f8fafc)',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateTreatmentModal(false);
                    setShowEditTreatmentModal(false);
                  }}
                  style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingTreatment}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                >
                  {savingTreatment ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                  <span>{showCreateTreatmentModal ? t('common.create', 'Create') : t('common.saveChanges', 'Save Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: ADD / EDIT DIAGNOSTIC                          */}
      {/* ═════════════════════════════════════════════════ */}
      {(showCreateDiagnosticModal || showEditDiagnosticModal) && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => {
            if (!savingDiagnostic) {
              setShowCreateDiagnosticModal(false);
              setShowEditDiagnosticModal(false);
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {showCreateDiagnosticModal
                    ? t('odontogramSettings.diagnosticsTab.addModalTitle', 'Add Odontogram Diagnostic')
                    : t('odontogramSettings.diagnosticsTab.editModalTitle', 'Edit Odontogram Diagnostic')}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  {showCreateDiagnosticModal
                    ? t('odontogramSettings.diagnosticsTab.subtitle', 'Configure clinical findings and tooth diagnostic markers')
                    : selectedDiagnostic?.name}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowCreateDiagnosticModal(false);
                  setShowEditDiagnosticModal(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={showCreateDiagnosticModal ? handleCreateDiagnostic : handleUpdateDiagnostic}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Branch Selection (for Tenant Admin in Create Mode) */}
                {showCreateDiagnosticModal && (isTenantAdmin || isSuperAdmin) && branches.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('odontogramSettings.diagnosticsTab.branch', 'Clinic Branch')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={diagnosticForm.branchId}
                      onChange={(e) => setDiagnosticForm({ ...diagnosticForm, branchId: e.target.value })}
                      required
                      style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.diagnosticsTab.name', 'Diagnostic Name')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t(
                      'odontogramSettings.diagnosticsTab.namePlaceholder',
                      'e.g. Dental Caries, Tooth Fracture, Missing Tooth'
                    )}
                    value={diagnosticForm.name}
                    onChange={(e) => setDiagnosticForm({ ...diagnosticForm, name: e.target.value })}
                    required
                    style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.diagnosticsTab.description', 'Description')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t(
                      'odontogramSettings.diagnosticsTab.descPlaceholder',
                      'Optional diagnostic description or symptoms'
                    )}
                    value={diagnosticForm.description || ''}
                    onChange={(e) => setDiagnosticForm({ ...diagnosticForm, description: e.target.value })}
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', minHeight: '72px' }}
                  />
                </div>

                {/* Color Picker with modern styling */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('odontogramSettings.diagnosticsTab.color', 'Color')} <span style={{ color: 'var(--rose-500, #f43f5e)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                      <input
                        type="color"
                        value={diagnosticForm.color}
                        onChange={(e) =>
                          setDiagnosticForm({ ...diagnosticForm, color: e.target.value.toUpperCase() })
                        }
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: diagnosticForm.color,
                          border: '2px solid var(--border-color)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={diagnosticForm.color}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          setDiagnosticForm({ ...diagnosticForm, color: val.toUpperCase() });
                        }}
                        placeholder="#EF4444"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        maxLength={7}
                        required
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          height: '36px',
                          fontSize: '13px',
                          width: '100%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Preset Swatches Palette */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      {t('odontogramSettings.quickPresets', 'Quick Presets')}:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((color) => {
                        const isSelected = diagnosticForm.color.toUpperCase() === color.toUpperCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setDiagnosticForm({ ...diagnosticForm, color })}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              border: isSelected ? '2px solid var(--text-heading)' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: isSelected ? 'scale(1.15)' : 'none',
                              boxShadow: isSelected ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                            title={color}
                          >
                            {isSelected && <Check size={14} style={{ color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Applies to Whole Tooth */}
                <div
                  onClick={() =>
                    setDiagnosticForm({
                      ...diagnosticForm,
                      appliesToWholeTooth: !diagnosticForm.appliesToWholeTooth,
                    })
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    backgroundColor: diagnosticForm.appliesToWholeTooth ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-app)',
                    border: `1.5px solid ${diagnosticForm.appliesToWholeTooth ? 'var(--primary-500, #14b8a6)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    id="diagnosticAppliesWhole"
                    checked={diagnosticForm.appliesToWholeTooth}
                    onChange={(e) =>
                      setDiagnosticForm({ ...diagnosticForm, appliesToWholeTooth: e.target.checked })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '2px',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--primary-500, #14b8a6)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, display: 'block', color: 'var(--text-heading)', fontSize: '13px' }}>
                      {t('odontogramSettings.diagnosticsTab.appliesToWholeTooth', 'Applies to Whole Tooth')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', display: 'block', marginTop: '3px', lineHeight: 1.45 }}>
                      {t(
                        'odontogramSettings.diagnosticsTab.appliesHelp',
                        'When checked, this diagnostic applies to the entire tooth structure instead of individual tooth faces.'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  backgroundColor: 'var(--bg-modal-footer, #f8fafc)',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateDiagnosticModal(false);
                    setShowEditDiagnosticModal(false);
                  }}
                  style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingDiagnostic}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                >
                  {savingDiagnostic ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                  <span>{showCreateDiagnosticModal ? t('common.create', 'Create') : t('common.saveChanges', 'Save Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: DELETE CONFIRMATION (TREATMENT / DIAGNOSTIC)   */}
      {/* ═════════════════════════════════════════════════ */}
      {showDeleteTreatmentModal && treatmentToDelete && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => !deletingTreatment && setShowDeleteTreatmentModal(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--rose-500, #f43f5e)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <span>{t('odontogramSettings.treatmentsTab.deleteModalTitle', 'Delete Treatment')}</span>
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowDeleteTreatmentModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.55 }}>
                {t(
                  'odontogramSettings.treatmentsTab.deleteConfirm',
                  'Are you sure you want to delete the treatment "{{name}}"? This action cannot be undone.',
                  { name: treatmentToDelete.name }
                )}
              </p>
            </div>
            <div
              style={{
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: 'var(--bg-modal-footer, #f8fafc)',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteTreatmentModal(false)}
                style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteTreatment}
                disabled={deletingTreatment}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  backgroundColor: 'var(--rose-500, #f43f5e)',
                  color: '#fff',
                }}
              >
                {deletingTreatment ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                <span>{t('common.delete', 'Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDiagnosticModal && diagnosticToDelete && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => !deletingDiagnostic && setShowDeleteDiagnosticModal(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--rose-500, #f43f5e)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <span>{t('odontogramSettings.diagnosticsTab.deleteModalTitle', 'Delete Diagnostic')}</span>
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowDeleteDiagnosticModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.55 }}>
                {t(
                  'odontogramSettings.diagnosticsTab.deleteConfirm',
                  'Are you sure you want to delete the diagnostic "{{name}}"? This action cannot be undone.',
                  { name: diagnosticToDelete.name }
                )}
              </p>
            </div>
            <div
              style={{
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: 'var(--bg-modal-footer, #f8fafc)',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteDiagnosticModal(false)}
                style={{ height: '38px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteDiagnostic}
                disabled={deletingDiagnostic}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  backgroundColor: 'var(--rose-500, #f43f5e)',
                  color: '#fff',
                }}
              >
                {deletingDiagnostic ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                <span>{t('common.delete', 'Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicOdontogramSettingsPage;
