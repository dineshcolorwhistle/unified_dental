import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Activity,
  Layers,
  Save,
  Loader2,
  AlertCircle,
  Eraser,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { ToothIcon } from '../../components/common/ToothIcon';
import {
  PatientTeethChart,
  FindingItem,
  getSurfaceDisplayName,
  getToothZoneAndQuadrant,
  ToothZone,
  ToothQuadrant,
} from '../../components/clinic/PatientTeethChart';
import {
  clinicOdontogramService,
  TeethModel,
  PatientOdontogramResponse,
  OdontogramDiagnosticItem,
  OdontogramTreatmentItem,
} from '../../services/clinicOdontogramService';

type ActiveTab = 'DIAGNOSTICS' | 'TREATMENT';

interface BrushCondition {
  id?: string;
  name: string;
  color: string;
  appliesToWholeTooth: boolean;
}

export interface AppliedTreatmentItem {
  id?: string;
  toothNumber: number;
  surface: string; // WHOLE, OCCLUSAL, VESTIBULAR, LINGUAL, PALATAL, CERVICAL, MESIAL, DISTAL
  treatmentName: string;
  color: string;
  treatmentId?: string | null;
  notes?: string | null;
}

// Fallback diagnostics ONLY if clinic settings are completely empty
const DEFAULT_DIAGNOSTICS: BrushCondition[] = [
  { name: 'Damaged', color: '#f87171', appliesToWholeTooth: false },
  { name: 'Filling', color: '#38bdf8', appliesToWholeTooth: true },
  { name: 'Healthy', color: '#10b981', appliesToWholeTooth: false },
  { name: 'Missing', color: '#94a3b8', appliesToWholeTooth: true },
  { name: 'Crown', color: '#a855f7', appliesToWholeTooth: true },
  { name: 'Implant', color: '#f59e0b', appliesToWholeTooth: true },
];

// Fallback treatments ONLY if clinic settings are completely empty
const DEFAULT_TREATMENTS: BrushCondition[] = [
  { name: 'Restoration', color: '#38bdf8', appliesToWholeTooth: false },
  { name: 'Crown', color: '#a855f7', appliesToWholeTooth: true },
  { name: 'Implant', color: '#f59e0b', appliesToWholeTooth: true },
  { name: 'Root Canal', color: '#ef4444', appliesToWholeTooth: true },
  { name: 'Extraction', color: '#64748b', appliesToWholeTooth: true },
  { name: 'Prophylaxis', color: '#10b981', appliesToWholeTooth: true },
];

export const PatientOdontogramPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isTenantAdmin, isClinicAdmin, user } = useAuth();

  const isSuperAdmin = user?.isSuperAdmin;
  const canModify = isClinicAdmin || isTenantAdmin || isSuperAdmin;

  // Main Loading & State
  const [loading, setLoading] = useState<boolean>(true);
  const [savingAll, setSavingAll] = useState<boolean>(false);
  const [data, setData] = useState<PatientOdontogramResponse | null>(null);

  // Tabs: 'Diagnostics' vs 'Treatment'
  const [activeTab, setActiveTab] = useState<ActiveTab>('DIAGNOSTICS');

  // Patient Dentition Model (isolated to patient, never modifies ClinicOdontogramConfig)
  const [localTeethModel, setLocalTeethModel] = useState<TeethModel>('ADULT');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Catalogs fetched dynamically from Odontogram Settings
  const [catalogDiagnostics, setCatalogDiagnostics] = useState<OdontogramDiagnosticItem[]>([]);
  const [catalogTreatments, setCatalogTreatments] = useState<OdontogramTreatmentItem[]>([]);

  // Diagnostics Tab State
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [activeDiagBrush, setActiveDiagBrush] = useState<BrushCondition | 'CLEAR'>(
    DEFAULT_DIAGNOSTICS[0],
  );

  // Treatment Tab State
  const [appliedTreatments, setAppliedTreatments] = useState<AppliedTreatmentItem[]>([]);
  const [activeTreatBrush, setActiveTreatBrush] = useState<BrushCondition | 'CLEAR'>(
    DEFAULT_TREATMENTS[0],
  );

  // Selected tooth & surface in chart
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);

  // General Clinical Notes
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Format date helper
  const formatLastSaved = (dateStr?: string | null): string => {
    if (!dateStr) return 'Not saved yet';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Not saved yet';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Fetch Patient Odontogram & Settings Catalogs
  const fetchData = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const res = await clinicOdontogramService.getPatientOdontogram(patientId);
      setData(res);

      // Restore saved model (defaults to ADULT)
      const savedModel = res.odontogram?.teethModel || 'ADULT';
      setLocalTeethModel(savedModel);

      // Restore clinical notes
      setGeneralNotes(res.odontogram?.notes || '');

      // Restore last saved time
      setLastSavedTime(res.odontogram?.updatedAt || res.odontogram?.createdAt || null);

      // Restore Diagnostics findings
      const initialFindings: FindingItem[] = (res.diagnostics || []).map((d) => ({
        id: d.id,
        toothNumber: d.toothNumber,
        surface: d.surface || 'WHOLE',
        name: d.diagnosticName,
        diagnosticName: d.diagnosticName,
        color: d.color || '#EF4444',
        notes: d.notes,
        diagnosticId: d.diagnosticId,
      }));
      setFindings(initialFindings);

      // Restore Treatments
      const initialTreatments: AppliedTreatmentItem[] = (res.treatments || []).map((tr) => ({
        id: tr.id,
        toothNumber: tr.toothNumber,
        surface: tr.surface || 'WHOLE',
        treatmentName: tr.treatmentName,
        color: tr.color || '#3B82F6',
        treatmentId: tr.treatmentId,
        notes: tr.notes,
      }));
      setAppliedTreatments(initialTreatments);

      // Dynamically load branch/tenant catalogs from Odontogram Settings
      const branchId = res.patient.branch?.id;
      const [diags, treats] = await Promise.all([
        clinicOdontogramService.getDiagnostics(branchId),
        clinicOdontogramService.getTreatments(branchId),
      ]);

      setCatalogDiagnostics(diags || []);
      setCatalogTreatments(treats || []);

      // Set initial active brushes based on dynamic lists if available
      if (diags && diags.length > 0) {
        setActiveDiagBrush({
          id: diags[0].id,
          name: diags[0].name,
          color: diags[0].color,
          appliesToWholeTooth: diags[0].appliesToWholeTooth,
        });
      }
      if (treats && treats.length > 0) {
        setActiveTreatBrush({
          id: treats[0].id,
          name: treats[0].name,
          color: treats[0].color,
          appliesToWholeTooth: treats[0].appliesToWholeTooth,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('patientOdontogram.failedLoad', 'Failed to load patient odontogram details')
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamic Diagnostics Brush List (from Odontogram Settings)
  const dynamicDiagnostics: BrushCondition[] = useMemo(() => {
    if (catalogDiagnostics.length > 0) {
      return catalogDiagnostics.map((cd) => ({
        id: cd.id,
        name: cd.name,
        color: cd.color || '#f87171',
        appliesToWholeTooth: !!cd.appliesToWholeTooth,
      }));
    }
    return DEFAULT_DIAGNOSTICS;
  }, [catalogDiagnostics]);

  // Dynamic Treatments Brush List (from Odontogram Settings)
  const dynamicTreatments: BrushCondition[] = useMemo(() => {
    if (catalogTreatments.length > 0) {
      return catalogTreatments.map((ct) => ({
        id: ct.id,
        name: ct.name,
        color: ct.color || '#3b82f6',
        appliesToWholeTooth: !!ct.appliesToWholeTooth,
      }));
    }
    return DEFAULT_TREATMENTS;
  }, [catalogTreatments]);

  // Teeth Chart Items for Diagnostics Tab
  const diagnosticChartItems: FindingItem[] = useMemo(() => {
    return findings.map((d) => ({
      id: d.id,
      toothNumber: d.toothNumber,
      surface: d.surface,
      name: d.diagnosticName,
      diagnosticName: d.diagnosticName,
      color: d.color,
      notes: d.notes,
      diagnosticId: d.diagnosticId,
    }));
  }, [findings]);

  // Teeth Chart Items for Treatment Tab
  const treatmentChartItems: FindingItem[] = useMemo(() => {
    return appliedTreatments.map((tr) => ({
      id: tr.id,
      toothNumber: tr.toothNumber,
      surface: tr.surface,
      name: tr.treatmentName,
      treatmentName: tr.treatmentName,
      color: tr.color,
      notes: tr.notes,
      treatmentId: tr.treatmentId,
    }));
  }, [appliedTreatments]);

  // Group Applied Treatments by Zone & Quadrant for Treatment Tab view
  const treatmentsByZoneAndQuad = useMemo(() => {
    const map = {
      POSTERIOR: {
        Q1: [] as AppliedTreatmentItem[],
        Q2: [] as AppliedTreatmentItem[],
        Q3: [] as AppliedTreatmentItem[],
        Q4: [] as AppliedTreatmentItem[],
      },
      ANTERIOR: {
        Q1: [] as AppliedTreatmentItem[],
        Q2: [] as AppliedTreatmentItem[],
        Q3: [] as AppliedTreatmentItem[],
        Q4: [] as AppliedTreatmentItem[],
      },
    };

    appliedTreatments.forEach((tr) => {
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      map[zone][quadrant].push(tr);
    });

    return map;
  }, [appliedTreatments]);

  // Selected tooth zone & quadrant for interactive quadrant view highlighting
  const selectedZoneQuad = useMemo<{ zone: ToothZone; quadrant: ToothQuadrant } | null>(() => {
    if (!selectedTooth) return null;
    return getToothZoneAndQuadrant(selectedTooth);
  }, [selectedTooth]);

  // ─── Interaction Handlers: Diagnostics Tab ───────────────
  const handleDiagnosticSurfaceClick = (toothNumber: number, surface: string) => {
    if (!canModify) return;

    setSelectedTooth(toothNumber);
    setSelectedSurface(surface);

    if (activeDiagBrush === 'CLEAR') {
      setFindings((prev) =>
        prev.filter((f) => !(f.toothNumber === toothNumber && f.surface.toUpperCase() === surface.toUpperCase()))
      );
      return;
    }

    if (activeDiagBrush.appliesToWholeTooth) {
      setFindings((prev) => {
        const filtered = prev.filter(
          (f) => !(f.toothNumber === toothNumber && f.surface.toUpperCase() === 'WHOLE')
        );
        return [
          ...filtered,
          {
            toothNumber,
            surface: 'WHOLE',
            diagnosticName: activeDiagBrush.name,
            color: activeDiagBrush.color,
            diagnosticId: activeDiagBrush.id,
          },
        ];
      });
      return;
    }

    setFindings((prev) => {
      const filtered = prev.filter(
        (f) => !(f.toothNumber === toothNumber && f.surface.toUpperCase() === surface.toUpperCase())
      );
      return [
        ...filtered,
        {
          toothNumber,
          surface: surface.toUpperCase(),
          diagnosticName: activeDiagBrush.name,
          color: activeDiagBrush.color,
          diagnosticId: activeDiagBrush.id,
        },
      ];
    });
  };

  const handleDiagnosticToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber);
    if (!canModify) return;

    if (activeDiagBrush === 'CLEAR') {
      setFindings((prev) => prev.filter((f) => f.toothNumber !== toothNumber));
      return;
    }

    if (activeDiagBrush.appliesToWholeTooth) {
      handleDiagnosticSurfaceClick(toothNumber, 'WHOLE');
    }
  };

  // ─── Interaction Handlers: Treatment Tab ────────────────
  const handleTreatmentSurfaceClick = (toothNumber: number, surface: string) => {
    if (!canModify) return;

    setSelectedTooth(toothNumber);
    setSelectedSurface(surface);

    if (activeTreatBrush === 'CLEAR') {
      setAppliedTreatments((prev) =>
        prev.filter((tr) => !(tr.toothNumber === toothNumber && tr.surface.toUpperCase() === surface.toUpperCase()))
      );
      return;
    }

    if (activeTreatBrush.appliesToWholeTooth) {
      setAppliedTreatments((prev) => {
        const filtered = prev.filter(
          (tr) => !(tr.toothNumber === toothNumber && tr.surface.toUpperCase() === 'WHOLE')
        );
        return [
          ...filtered,
          {
            toothNumber,
            surface: 'WHOLE',
            treatmentName: activeTreatBrush.name,
            color: activeTreatBrush.color,
            treatmentId: activeTreatBrush.id,
          },
        ];
      });
      return;
    }

    setAppliedTreatments((prev) => {
      const filtered = prev.filter(
        (tr) => !(tr.toothNumber === toothNumber && tr.surface.toUpperCase() === surface.toUpperCase())
      );
      return [
        ...filtered,
        {
          toothNumber,
          surface: surface.toUpperCase(),
          treatmentName: activeTreatBrush.name,
          color: activeTreatBrush.color,
          treatmentId: activeTreatBrush.id,
        },
      ];
    });
  };

  const handleTreatmentToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber);
    if (!canModify) return;

    if (activeTreatBrush === 'CLEAR') {
      setAppliedTreatments((prev) => prev.filter((tr) => tr.toothNumber !== toothNumber));
      return;
    }

    if (activeTreatBrush.appliesToWholeTooth) {
      handleTreatmentSurfaceClick(toothNumber, 'WHOLE');
    }
  };

  const handleRemoveTreatment = (item: AppliedTreatmentItem) => {
    if (!canModify) return;
    setAppliedTreatments((prev) =>
      prev.filter(
        (tr) =>
          !(
            tr.toothNumber === item.toothNumber &&
            tr.surface.toUpperCase() === item.surface.toUpperCase() &&
            tr.treatmentName === item.treatmentName
          )
      )
    );
  };

  const handleClearQuadrantTreatments = (zone: ToothZone, quadrant: ToothQuadrant) => {
    if (!canModify) return;
    setAppliedTreatments((prev) =>
      prev.filter((tr) => {
        const zq = getToothZoneAndQuadrant(tr.toothNumber);
        return !(zq.zone === zone && zq.quadrant === quadrant);
      })
    );
  };

  // ─── Save All State Atomically ──────────────────────────
  const handleSaveOdontogram = async () => {
    if (!patientId || !canModify) return;

    try {
      setSavingAll(true);
      await clinicOdontogramService.savePatientOdontogram(patientId, {
        teethModel: localTeethModel,
        notes: generalNotes,
        diagnostics: findings.map((f) => ({
          toothNumber: f.toothNumber,
          surface: f.surface,
          diagnosticName: f.diagnosticName || f.name || '',
          color: f.color,
          notes: f.notes || undefined,
          diagnosticId: f.diagnosticId || undefined,
        })),
        treatments: appliedTreatments.map((tr) => ({
          toothNumber: tr.toothNumber,
          surface: tr.surface,
          treatmentName: tr.treatmentName,
          color: tr.color,
          status: 'PLANNED',
          notes: tr.notes || undefined,
          treatmentId: tr.treatmentId || undefined,
        })),
      });

      const now = new Date().toISOString();
      setLastSavedTime(now);
      toast.success(
        t('patientOdontogram.saveSuccess', 'Patient odontogram saved successfully')
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('patientOdontogram.saveFailed', 'Failed to save patient odontogram')
      );
    } finally {
      setSavingAll(false);
    }
  };

  // Format patient full name
  const patientFullName = useMemo(() => {
    if (!data?.patient) return '';
    const parts = [
      data.patient.firstName,
      data.patient.fatherLastName,
      data.patient.motherLastName,
    ].filter(Boolean);
    return parts.join(' ');
  }, [data?.patient]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 0',
          gap: '12px',
        }}
      >
        <Loader2 size={36} className="spinner" style={{ color: 'var(--primary-600, #0d9488)' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {t('patientOdontogram.loading', 'Loading patient odontogram...')}
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/clinic/patients')}
          style={{ marginBottom: '16px' }}
        >
          <ArrowLeft size={16} style={{ marginRight: '6px' }} />
          {t('patientOdontogram.backToPatients', 'Back to Patients')}
        </button>
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <AlertCircle size={36} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
          <h3>{t('patientOdontogram.failedLoad', 'Patient not found or inaccessible')}</h3>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* ─── Top Header Card ─── */}
      <div
        className="card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Left: Icon Box + Title + Record Number Pill + Subtitle Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.14)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ToothIcon size={26} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#1e293b',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Patient Odontogram
                </h1>
                <span
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  #{data.patient.recordNumber}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '5px',
                  fontSize: '13px',
                  color: '#64748b',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  Patient: <strong style={{ color: '#1e293b' }}>{patientFullName}</strong>
                </span>
                <span>
                  Doctor: <strong style={{ color: '#1e293b' }}>Dr. Robert Smith</strong>
                </span>
                {data.patient.branch && (
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    {data.patient.branch.name}
                  </span>
                )}
                <span style={{ color: '#94a3b8' }}>
                  Last saved: {formatLastSaved(lastSavedTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Teeth Model Switcher Pills + Header Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '3px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setLocalTeethModel('ADULT')}
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: localTeethModel === 'ADULT' ? '#38bdf8' : 'transparent',
                  color: localTeethModel === 'ADULT' ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                Adult (32)
              </button>
              <button
                type="button"
                onClick={() => setLocalTeethModel('CHILD')}
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: localTeethModel === 'CHILD' ? '#38bdf8' : 'transparent',
                  color: localTeethModel === 'CHILD' ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                Child (20)
              </button>
              <button
                type="button"
                onClick={() => setLocalTeethModel('COMPLETE')}
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: localTeethModel === 'COMPLETE' ? '#38bdf8' : 'transparent',
                  color: localTeethModel === 'COMPLETE' ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                Complete (52)
              </button>
            </div>

            {canModify && (
              <button
                type="button"
                onClick={handleSaveOdontogram}
                disabled={savingAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#38bdf8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: savingAll ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(56, 189, 248, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {savingAll ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                <span>Save Odontogram</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs Bar (Renamed to Diagnostics and Treatment) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          paddingBottom: '2px',
        }}
      >
        {/* Tab 1: Diagnostics */}
        <button
          type="button"
          onClick={() => setActiveTab('DIAGNOSTICS')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'DIAGNOSTICS' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '14px',
            fontWeight: activeTab === 'DIAGNOSTICS' ? 700 : 500,
            color: activeTab === 'DIAGNOSTICS' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={17} style={{ color: activeTab === 'DIAGNOSTICS' ? '#0284c7' : '#94a3b8' }} />
          <span>Diagnostics</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'DIAGNOSTICS' ? '#38bdf8' : '#e2e8f0',
              color: activeTab === 'DIAGNOSTICS' ? '#ffffff' : '#64748b',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
              minWidth: '20px',
            }}
          >
            {findings.length}
          </span>
        </button>

        {/* Tab 2: Treatment */}
        <button
          type="button"
          onClick={() => setActiveTab('TREATMENT')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'TREATMENT' ? '2.5px solid #0284c7' : '2.5px solid transparent',
            padding: '10px 4px',
            fontSize: '14px',
            fontWeight: activeTab === 'TREATMENT' ? 700 : 500,
            color: activeTab === 'TREATMENT' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={17} style={{ color: activeTab === 'TREATMENT' ? '#0284c7' : '#94a3b8' }} />
          <span>Treatment</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'TREATMENT' ? '#38bdf8' : '#e2e8f0',
              color: activeTab === 'TREATMENT' ? '#ffffff' : '#64748b',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
              minWidth: '20px',
            }}
          >
            {appliedTreatments.length}
          </span>
        </button>
      </div>

      {/* ─── TAB CONTENT 1: DIAGNOSTICS ─── */}
      {activeTab === 'DIAGNOSTICS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Card: Dynamic Diagnostic Brush Selector & Teeth Chart */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                fontSize: '12.5px',
                color: '#64748b',
                marginBottom: '16px',
              }}
            >
              Click a tooth block to mark its diagnostic condition. Conditions with "Whole" badge apply to the entire tooth.
            </div>

            {/* Dynamic Diagnostics Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              {/* Clear Tool */}
              <button
                type="button"
                onClick={() => setActiveDiagBrush('CLEAR')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: activeDiagBrush === 'CLEAR' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  backgroundColor: activeDiagBrush === 'CLEAR' ? 'rgba(239, 68, 68, 0.08)' : '#ffffff',
                  color: activeDiagBrush === 'CLEAR' ? '#ef4444' : '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Eraser size={15} />
                <span>Clear</span>
              </button>

              {/* Dynamic Diagnostic Pills */}
              {dynamicDiagnostics.map((condition) => {
                const isSelected =
                  activeDiagBrush !== 'CLEAR' && activeDiagBrush.name === condition.name;

                return (
                  <button
                    key={condition.name}
                    type="button"
                    onClick={() => setActiveDiagBrush(condition)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: isSelected
                        ? `2px solid ${condition.color}`
                        : '1px solid #cbd5e1',
                      backgroundColor: isSelected
                        ? `${condition.color}15`
                        : '#ffffff',
                      color: isSelected ? condition.color : '#334155',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        backgroundColor: condition.color,
                      }}
                    />
                    <span>{condition.name}</span>
                    {isSelected && <Check size={14} style={{ color: condition.color }} />}
                    {condition.appliesToWholeTooth && (
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        Whole
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Interactive Teeth Chart */}
            <PatientTeethChart
              teethModel={localTeethModel}
              findings={diagnosticChartItems}
              selectedTooth={selectedTooth}
              selectedSurface={selectedSurface}
              onToothClick={handleDiagnosticToothClick}
              onSurfaceClick={handleDiagnosticSurfaceClick}
            />
          </div>

          {/* Bottom Split Section: Applied Findings & Clinical Notes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Left Card: Applied Findings & Markings (N) */}
            <div
              className="card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#1e293b',
                    margin: 0,
                  }}
                >
                  Applied Findings & Markings ({findings.length})
                </h3>

                {findings.length > 0 && canModify && (
                  <button
                    type="button"
                    onClick={() => setFindings([])}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignContent: 'flex-start',
                  minHeight: '120px',
                }}
              >
                {findings.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '30px 10px',
                      color: '#94a3b8',
                      fontSize: '13px',
                      textAlign: 'center',
                    }}
                  >
                    No findings or markings applied yet. Click any tooth block above to mark diagnostic conditions.
                  </div>
                ) : (
                  findings.map((f, idx) => (
                    <div
                      key={`${f.toothNumber}-${f.surface}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        color: '#9f1239',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '2px',
                          backgroundColor: f.color,
                        }}
                      />
                      <span>
                        <strong>T{f.toothNumber}</strong> ({getSurfaceDisplayName(f.surface, f.toothNumber)}): <strong>{f.diagnosticName || f.name}</strong>
                      </span>
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => setFindings((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9f1239',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1px',
                            marginLeft: '2px',
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Card: Odontogram / Clinical Notes */}
            <div
              className="card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#1e293b',
                    margin: 0,
                  }}
                >
                  Odontogram / Clinical Notes
                </h3>
              </div>

              <textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Optional notes regarding teeth condition, prosthetic specifications, or clinical findings..."
                disabled={!canModify}
                rows={5}
                style={{
                  width: '100%',
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#1e293b',
                  backgroundColor: canModify ? '#ffffff' : '#f8fafc',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '120px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT 2: TREATMENT (Quadrant View for Zona Posterior & Zona Anterior) ─── */}
      {activeTab === 'TREATMENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Card: Dynamic Treatments Toolbar & Treatment Teeth Chart */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                fontSize: '12.5px',
                color: '#64748b',
                marginBottom: '16px',
              }}
            >
              Click a tooth block or surface to assign treatment procedures. The applied treatments will populate the corresponding quadrant below.
            </div>

            {/* Dynamic Treatment Brush Selector Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              {/* Clear Tool */}
              <button
                type="button"
                onClick={() => setActiveTreatBrush('CLEAR')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: activeTreatBrush === 'CLEAR' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  backgroundColor: activeTreatBrush === 'CLEAR' ? 'rgba(239, 68, 68, 0.08)' : '#ffffff',
                  color: activeTreatBrush === 'CLEAR' ? '#ef4444' : '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Eraser size={15} />
                <span>Clear</span>
              </button>

              {/* Dynamic Treatment Pills from Odontogram Settings */}
              {dynamicTreatments.map((treatment) => {
                const isSelected =
                  activeTreatBrush !== 'CLEAR' && activeTreatBrush.name === treatment.name;

                return (
                  <button
                    key={treatment.name}
                    type="button"
                    onClick={() => setActiveTreatBrush(treatment)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: isSelected
                        ? `2px solid ${treatment.color}`
                        : '1px solid #cbd5e1',
                      backgroundColor: isSelected
                        ? `${treatment.color}15`
                        : '#ffffff',
                      color: isSelected ? treatment.color : '#334155',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        backgroundColor: treatment.color,
                      }}
                    />
                    <span>{treatment.name}</span>
                    {isSelected && <Check size={14} style={{ color: treatment.color }} />}
                    {treatment.appliesToWholeTooth && (
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        Whole
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Separate Teeth Chart for Treatment */}
            <PatientTeethChart
              teethModel={localTeethModel}
              findings={treatmentChartItems}
              selectedTooth={selectedTooth}
              selectedSurface={selectedSurface}
              onToothClick={handleTreatmentToothClick}
              onSurfaceClick={handleTreatmentSurfaceClick}
            />
          </div>

          {/* ─── QUADRANT VIEW: ZONA POSTERIOR & ZONA ANTERIOR (Matches media_1793365021402_79269420.png) ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: '20px',
            }}
          >
            {/* ─── CARD 1: ZONA POSTERIOR ─── */}
            <div
              className="card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Header Title in Orange Uppercase */}
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#ea580c',
                  letterSpacing: '0.04em',
                  marginBottom: '14px',
                  textTransform: 'uppercase',
                }}
              >
                ZONA POSTERIOR
              </div>

              {/* 2x2 Quadrant Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                {/* Q1 Posterior */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'POSTERIOR' && selectedZoneQuad?.quadrant === 'Q1';
                  const items = treatmentsByZoneAndQuad.POSTERIOR.Q1;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(2, 132, 199, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q1
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('POSTERIOR', 'Q1')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`post-q1-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#0369a1',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q2 Posterior (Blue accent left border) */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'POSTERIOR' && selectedZoneQuad?.quadrant === 'Q2';
                  const items = treatmentsByZoneAndQuad.POSTERIOR.Q2;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        borderLeft: '2.5px solid #0284c7',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(2, 132, 199, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q2
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('POSTERIOR', 'Q2')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`post-q2-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#0369a1',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q3 Posterior */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'POSTERIOR' && selectedZoneQuad?.quadrant === 'Q3';
                  const items = treatmentsByZoneAndQuad.POSTERIOR.Q3;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(2, 132, 199, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q3
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('POSTERIOR', 'Q3')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`post-q3-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#0369a1',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q4 Posterior (Blue accent left border) */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'POSTERIOR' && selectedZoneQuad?.quadrant === 'Q4';
                  const items = treatmentsByZoneAndQuad.POSTERIOR.Q4;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        borderLeft: '2.5px solid #0284c7',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(2, 132, 199, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q4
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('POSTERIOR', 'Q4')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`post-q4-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#0369a1',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ─── CARD 2: ZONA ANTERIOR ─── */}
            <div
              className="card"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Header Title in Orange Uppercase */}
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#ea580c',
                  letterSpacing: '0.04em',
                  marginBottom: '14px',
                  textTransform: 'uppercase',
                }}
              >
                ZONA ANTERIOR
              </div>

              {/* 2x2 Quadrant Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                {/* Q1 Anterior */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'ANTERIOR' && selectedZoneQuad?.quadrant === 'Q1';
                  const items = treatmentsByZoneAndQuad.ANTERIOR.Q1;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #ec4899' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(236, 72, 153, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q1
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('ANTERIOR', 'Q1')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`ant-q1-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#fdf2f8',
                              border: '1px solid #fbcfe8',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#9d174d',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#9d174d',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q2 Anterior (Pink accent left border) */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'ANTERIOR' && selectedZoneQuad?.quadrant === 'Q2';
                  const items = treatmentsByZoneAndQuad.ANTERIOR.Q2;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #ec4899' : '1px solid #e2e8f0',
                        borderLeft: '2.5px solid #ec4899',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(236, 72, 153, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q2
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('ANTERIOR', 'Q2')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`ant-q2-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#fdf2f8',
                              border: '1px solid #fbcfe8',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#9d174d',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#9d174d',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q3 Anterior */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'ANTERIOR' && selectedZoneQuad?.quadrant === 'Q3';
                  const items = treatmentsByZoneAndQuad.ANTERIOR.Q3;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #ec4899' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(236, 72, 153, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q3
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('ANTERIOR', 'Q3')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`ant-q3-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#fdf2f8',
                              border: '1px solid #fbcfe8',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#9d174d',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#9d174d',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q4 Anterior (Pink accent left border) */}
                {(() => {
                  const isHighlighted =
                    selectedZoneQuad?.zone === 'ANTERIOR' && selectedZoneQuad?.quadrant === 'Q4';
                  const items = treatmentsByZoneAndQuad.ANTERIOR.Q4;

                  return (
                    <div
                      style={{
                        border: isHighlighted ? '1.5px solid #ec4899' : '1px solid #e2e8f0',
                        borderLeft: '2.5px solid #ec4899',
                        borderRadius: '8px',
                        backgroundColor: isHighlighted ? 'rgba(236, 72, 153, 0.03)' : '#ffffff',
                        padding: '10px 12px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          Q4
                        </span>
                        {items.length > 0 && canModify && (
                          <button
                            type="button"
                            onClick={() => handleClearQuadrantTreatments('ANTERIOR', 'Q4')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {items.map((tr, i) => (
                          <div
                            key={`ant-q4-${tr.toothNumber}-${tr.surface}-${i}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#fdf2f8',
                              border: '1px solid #fbcfe8',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              color: '#9d174d',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                backgroundColor: tr.color,
                              }}
                            />
                            <span>
                              <strong>T{tr.toothNumber}</strong> ({getSurfaceDisplayName(tr.surface, tr.toothNumber)}): <strong>{tr.treatmentName}</strong>
                            </span>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTreatment(tr)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#9d174d',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── REQUIREMENT 5: PERSISTENT SAVE OPTION AT THE BOTTOM ─── */}
      <div
        className="card"
        style={{
          marginTop: '24px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {savingAll
              ? 'Saving changes...'
              : `Last saved: ${formatLastSaved(lastSavedTime)}`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/clinic/patients')}
            style={{ fontSize: '13px', height: '40px', padding: '0 16px' }}
          >
            {t('patientOdontogram.backToPatients', 'Back to Patients')}
          </button>

          {canModify && (
            <button
              type="button"
              onClick={handleSaveOdontogram}
              disabled={savingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#38bdf8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 24px',
                height: '40px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: savingAll ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(56, 189, 248, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              {savingAll ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
              <span>Save</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
