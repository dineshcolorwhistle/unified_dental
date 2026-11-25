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
  FileSpreadsheet,
  Lock,
  Info,
} from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { Tooltip } from '../../components/common/Tooltip';
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
import { formatDateTime } from '../../core/utils/dateUtils';

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

interface LinkedPlanRef {
  id: string;
  name: string;
  status: string;
}

interface BlockedLinkedTreatmentItem {
  toothNumber: number;
  surface: string;
  treatmentName: string;
  color: string;
  plans: LinkedPlanRef[];
}

interface LinkedTreatmentBlockState {
  actionType: 'clear' | 'replace';
  isBulkQuadrant: boolean;
  blockedItems: BlockedLinkedTreatmentItem[];
}

const PLAN_STATUS_META: Record<string, { labelKey: string; defaultLabel: string; bg: string; color: string; border: string }> = {
  CREATED: { labelKey: 'statusCreated', defaultLabel: 'Created', bg: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: 'rgba(59, 130, 246, 0.3)' },
  PRESENTED: { labelKey: 'statusPresented', defaultLabel: 'Presented', bg: 'rgba(99, 102, 241, 0.1)', color: '#4338ca', border: 'rgba(99, 102, 241, 0.3)' },
  ACCEPTED: { labelKey: 'statusAccepted', defaultLabel: 'Accepted', bg: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: 'rgba(16, 185, 129, 0.35)' },
  IN_PROGRESS: { labelKey: 'statusInProgress', defaultLabel: 'In Progress', bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: 'rgba(245, 158, 11, 0.35)' },
  COMPLETED: { labelKey: 'statusCompleted', defaultLabel: 'Completed', bg: 'rgba(13, 148, 136, 0.12)', color: '#0f766e', border: 'rgba(13, 148, 136, 0.35)' },
  CANCELLED: { labelKey: 'statusCancelled', defaultLabel: 'Cancelled', bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: 'rgba(100, 116, 139, 0.3)' },
  REJECTED: { labelKey: 'statusRejected', defaultLabel: 'Rejected', bg: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', border: 'rgba(239, 68, 68, 0.35)' },
};

const normalizeTreatmentName = (name?: string | null): string =>
  String(name || '')
    .replace(/\s*\([#\d\s,]+\)/g, '')
    .replace(/#\d+/g, '')
    .trim()
    .toLowerCase();

const extractPlanItemToothNumbers = (item: any): number[] => {
  const nums = new Set<number>();
  if (Array.isArray(item?.toothNumbers)) {
    item.toothNumbers.forEach((n: any) => {
      const parsed = Number(n);
      if (Number.isInteger(parsed) && parsed > 0) nums.add(parsed);
    });
  }
  if (item?.otTeethNumber) {
    String(item.otTeethNumber)
      .split(/[\s,;]+/)
      .forEach((token) => {
        const cleaned = token.replace(/#/g, '').trim();
        if (!cleaned) return;
        const parsed = Number(cleaned);
        if (Number.isInteger(parsed) && parsed > 0) nums.add(parsed);
      });
  }
  return Array.from(nums);
};


export const PatientOdontogramPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isTenantAdmin, isClinicAdmin, isClinicDoctor, user } = useAuth();
  const { socket } = useNotifications();

  const isSuperAdmin = user?.isSuperAdmin;
  const canModify = (isClinicAdmin || isClinicDoctor || Boolean(isSuperAdmin)) && !isTenantAdmin;

  // Main Loading & State
  const [loading, setLoading] = useState<boolean>(true);
  const [savingAll, setSavingAll] = useState<boolean>(false);
  const [data, setData] = useState<PatientOdontogramResponse | null>(null);
  const [linkedBlockModal, setLinkedBlockModal] = useState<LinkedTreatmentBlockState | null>(null);

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
  const [activeDiagBrush, setActiveDiagBrush] = useState<BrushCondition | 'CLEAR'>('CLEAR');

  // Treatment Tab State
  const [appliedTreatments, setAppliedTreatments] = useState<AppliedTreatmentItem[]>([]);
  const [activeTreatBrush, setActiveTreatBrush] = useState<BrushCondition | 'CLEAR'>('CLEAR');

  // Selected tooth & surface in chart
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);

  // Format date helper
  const formatLastSaved = (dateStr?: string | null): string => {
    if (!dateStr) return t('patientOdontogram.notSavedYet', 'Not saved yet');
    const formatted = formatDateTime(dateStr);
    return formatted === '—' ? t('patientOdontogram.notSavedYet', 'Not saved yet') : formatted;
  };

  // Sync local chart & metadata state from API response
  const syncStateFromResponse = useCallback((res: PatientOdontogramResponse) => {
    setData(res);
    setLocalTeethModel(res.odontogram?.teethModel || 'ADULT');
    setLastSavedTime(res.odontogram?.updatedAt || res.odontogram?.createdAt || null);

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
  }, []);

  // Fetch Patient Odontogram & Settings Catalogs
  const fetchData = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const res = await clinicOdontogramService.getPatientOdontogram(patientId);
      syncStateFromResponse(res);

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
  }, [patientId, syncStateFromResponse, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep proposedPlan linkage metadata in sync when Treatment Plan updates in another tab
  useEffect(() => {
    if (!socket || !patientId) return;
    const handlePlanUpdated = async (payload: any) => {
      if (payload?.patientId && payload.patientId !== patientId) return;
      try {
        const res = await clinicOdontogramService.getPatientOdontogram(patientId);
        setData(res);
      } catch {
        // Silent background refresh
      }
    };
    socket.on('treatment_plan:updated', handlePlanUpdated);
    return () => {
      socket.off('treatment_plan:updated', handlePlanUpdated);
    };
  }, [socket, patientId]);

  // Dynamic Diagnostics Brush List (from Odontogram Settings)
  const dynamicDiagnostics: BrushCondition[] = useMemo(() => {
    return catalogDiagnostics.map((cd) => ({
      id: cd.id,
      name: cd.name,
      color: cd.color || '#f87171',
      appliesToWholeTooth: !!cd.appliesToWholeTooth,
    }));
  }, [catalogDiagnostics]);

  // Dynamic Treatments Brush List (from Odontogram Settings)
  const dynamicTreatments: BrushCondition[] = useMemo(() => {
    return catalogTreatments.map((ct) => ({
      id: ct.id,
      name: ct.name,
      color: ct.color || '#3b82f6',
      appliesToWholeTooth: !!ct.appliesToWholeTooth,
    }));
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
      if (surface.toUpperCase() === 'WHOLE') {
        setFindings((prev) => prev.filter((f) => f.toothNumber !== toothNumber));
        return;
      }
      setFindings((prev) =>
        prev.filter((f) => !(f.toothNumber === toothNumber && f.surface.toUpperCase() === surface.toUpperCase()))
      );
      return;
    }

    if (!activeDiagBrush) return;

    if (surface.toUpperCase() === 'WHOLE' || activeDiagBrush.appliesToWholeTooth) {
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

  // Persisted Odontogram treatment IDs & Treatment Plan linkage lookup
  const savedTreatmentIds = useMemo(() => {
    return new Set((data?.treatments || []).map((tr) => tr.id).filter(Boolean));
  }, [data?.treatments]);

  const linkedPlanByTreatmentKey = useMemo(() => {
    const map = new Map<string, LinkedPlanRef[]>();
    const plan = (data?.odontogram as any)?.proposedPlan;
    const groups: any[] = Array.isArray(plan?.groups) ? plan.groups : [];

    groups.forEach((g, idx) => {
      const groupId = String(g?.id || `group-${idx + 1}`);
      const groupName = String(g?.name || `Plan ${idx + 1}`);
      const status = String(g?.status || (g?.confirmed ? 'ACCEPTED' : 'CREATED'));
      const items: any[] = Array.isArray(g?.items) ? g.items : [];

      items.forEach((it) => {
        const normalizedName = normalizeTreatmentName(it?.treatmentName);
        if (!normalizedName) return;
        const teeth = extractPlanItemToothNumbers(it);
        teeth.forEach((toothNum) => {
          const key = `${normalizedName}__${toothNum}`;
          const list = map.get(key) || [];
          if (!list.some((p) => p.id === groupId && p.name === groupName)) {
            list.push({ id: groupId, name: groupName, status });
          }
          map.set(key, list);
        });
      });
    });

    return map;
  }, [data?.odontogram]);

  const getLinkedPlansForTreatment = useCallback(
    (item: AppliedTreatmentItem): LinkedPlanRef[] => {
      // Newly brushed unsaved treatments (no persisted DB id yet) can still be undone before saving
      if (!item.id || !savedTreatmentIds.has(item.id)) return [];
      const key = `${normalizeTreatmentName(item.treatmentName)}__${item.toothNumber}`;
      return linkedPlanByTreatmentKey.get(key) || [];
    },
    [savedTreatmentIds, linkedPlanByTreatmentKey]
  );

  const buildBlockedModalData = useCallback(
    (
      items: AppliedTreatmentItem[],
      actionType: 'clear' | 'replace',
      isBulkQuadrant = false
    ): LinkedTreatmentBlockState | null => {
      const seen = new Set<string>();
      const blockedItems: BlockedLinkedTreatmentItem[] = [];

      items.forEach((tr) => {
        const plans = getLinkedPlansForTreatment(tr);
        if (plans.length === 0) return;
        const dedupeKey = `${tr.toothNumber}-${tr.surface.toUpperCase()}-${normalizeTreatmentName(tr.treatmentName)}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        blockedItems.push({
          toothNumber: tr.toothNumber,
          surface: tr.surface,
          treatmentName: tr.treatmentName,
          color: tr.color,
          plans,
        });
      });

      if (blockedItems.length === 0) return null;
      return { actionType, isBulkQuadrant, blockedItems };
    },
    [getLinkedPlansForTreatment]
  );

  // ─── Interaction Handlers: Treatment Tab ────────────────
  const handleTreatmentSurfaceClick = (toothNumber: number, surface: string) => {
    if (!canModify) return;

    setSelectedTooth(toothNumber);
    setSelectedSurface(surface);

    const upperSurface = surface.toUpperCase();

    if (activeTreatBrush === 'CLEAR') {
      const targeted =
        upperSurface === 'WHOLE'
          ? appliedTreatments.filter((tr) => tr.toothNumber === toothNumber)
          : appliedTreatments.filter(
              (tr) => tr.toothNumber === toothNumber && tr.surface.toUpperCase() === upperSurface
            );
      const blocked = buildBlockedModalData(targeted, 'clear');
      if (blocked) {
        setLinkedBlockModal(blocked);
        return;
      }

      if (upperSurface === 'WHOLE') {
        setAppliedTreatments((prev) => prev.filter((tr) => tr.toothNumber !== toothNumber));
        return;
      }
      setAppliedTreatments((prev) =>
        prev.filter((tr) => !(tr.toothNumber === toothNumber && tr.surface.toUpperCase() === upperSurface))
      );
      return;
    }

    if (!activeTreatBrush) return;

    const targetSurface =
      upperSurface === 'WHOLE' || activeTreatBrush.appliesToWholeTooth ? 'WHOLE' : upperSurface;

    const existingAtTarget = appliedTreatments.filter(
      (tr) => tr.toothNumber === toothNumber && tr.surface.toUpperCase() === targetSurface
    );
    const toReplace = existingAtTarget.filter(
      (tr) => normalizeTreatmentName(tr.treatmentName) !== normalizeTreatmentName(activeTreatBrush.name)
    );
    const blocked = buildBlockedModalData(toReplace, 'replace');
    if (blocked) {
      setLinkedBlockModal(blocked);
      return;
    }

    const preservedSame = existingAtTarget.find(
      (tr) => normalizeTreatmentName(tr.treatmentName) === normalizeTreatmentName(activeTreatBrush.name)
    );

    setAppliedTreatments((prev) => {
      const filtered = prev.filter(
        (tr) => !(tr.toothNumber === toothNumber && tr.surface.toUpperCase() === targetSurface)
      );
      return [
        ...filtered,
        {
          id: preservedSame?.id,
          toothNumber,
          surface: targetSurface,
          treatmentName: activeTreatBrush.name,
          color: activeTreatBrush.color,
          treatmentId: activeTreatBrush.id,
          notes: preservedSame?.notes,
        },
      ];
    });
  };

  const handleTreatmentToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber);
    if (!canModify) return;

    if (activeTreatBrush === 'CLEAR') {
      const targeted = appliedTreatments.filter((tr) => tr.toothNumber === toothNumber);
      const blocked = buildBlockedModalData(targeted, 'clear');
      if (blocked) {
        setLinkedBlockModal(blocked);
        return;
      }
      setAppliedTreatments((prev) => prev.filter((tr) => tr.toothNumber !== toothNumber));
      return;
    }

    if (activeTreatBrush.appliesToWholeTooth) {
      handleTreatmentSurfaceClick(toothNumber, 'WHOLE');
    }
  };

  const handleRemoveTreatment = (item: AppliedTreatmentItem) => {
    if (!canModify) return;
    const blocked = buildBlockedModalData([item], 'clear');
    if (blocked) {
      setLinkedBlockModal(blocked);
      return;
    }
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
    const targeted = appliedTreatments.filter((tr) => {
      const zq = getToothZoneAndQuadrant(tr.toothNumber);
      return zq.zone === zone && zq.quadrant === quadrant;
    });
    const blocked = buildBlockedModalData(targeted, 'clear', true);
    if (blocked) {
      setLinkedBlockModal(blocked);
      return;
    }
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
      const savedRes = await clinicOdontogramService.savePatientOdontogram(patientId, {
        teethModel: localTeethModel,
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

      syncStateFromResponse(savedRes);
      setLastSavedTime(savedRes.odontogram?.updatedAt || new Date().toISOString());
      toast.success(
        t('patientOdontogram.saveSuccess', 'Patient odontogram saved successfully')
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('patientOdontogram.saveFailed', 'Failed to save patient odontogram')
      );
      if (err?.response?.status === 400 || err?.response?.status === 409) {
        fetchData();
      }
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

  // Check if a treatment plan / treatments have already been saved or applied for this patient
  const hasSavedTreatmentPlan = useMemo(() => {
    // 1. Saved treatments on the patient's odontogram
    if (data?.treatments && data.treatments.length > 0) {
      return true;
    }
    // 2. Currently applied treatments in the odontogram
    if (appliedTreatments && appliedTreatments.length > 0) {
      return true;
    }
    // 3. Saved proposed plan in odontogram
    const plan = (data?.odontogram as any)?.proposedPlan;
    if (plan) {
      if (Array.isArray(plan.groups) && plan.groups.length > 0) {
        return true;
      }
      if (Array.isArray(plan) && plan.length > 0) {
        return true;
      }
    }
    return false;
  }, [data?.treatments, appliedTreatments, data?.odontogram]);

  const renderQuadrantBox = (
    zone: ToothZone,
    quadrant: ToothQuadrant,
    accentRightCol: boolean
  ) => {
    const isPosterior = zone === 'POSTERIOR';
    const highlightBorderColor = isPosterior ? '#0284c7' : '#ec4899';
    const highlightBgColor = isPosterior ? 'rgba(2, 132, 199, 0.03)' : 'rgba(236, 72, 153, 0.03)';
    const chipBg = isPosterior ? '#f0f9ff' : '#fdf2f8';
    const chipBorder = isPosterior ? '#bae6fd' : '#fbcfe8';
    const chipColor = isPosterior ? '#0369a1' : '#9d174d';

    const isHighlighted =
      selectedZoneQuad?.zone === zone && selectedZoneQuad?.quadrant === quadrant;
    const items = treatmentsByZoneAndQuad[zone][quadrant];

    return (
      <div
        key={`${zone}-${quadrant}`}
        style={{
          border: isHighlighted ? `1.5px solid ${highlightBorderColor}` : '1px solid #e2e8f0',
          borderLeft: accentRightCol
            ? `2.5px solid ${highlightBorderColor}`
            : isHighlighted
            ? `1.5px solid ${highlightBorderColor}`
            : '1px solid #e2e8f0',
          borderRadius: '8px',
          backgroundColor: isHighlighted ? highlightBgColor : '#ffffff',
          padding: '10px 12px',
          minHeight: '120px',
          minWidth: 0,
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
            {quadrant}
          </span>
          {items.length > 0 && canModify && (
            <button
              type="button"
              onClick={() => handleClearQuadrantTreatments(zone, quadrant)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 6px',
                minHeight: '28px',
              }}
            >
              {t('patientOdontogram.clear', 'Clear')}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {items.map((tr, i) => {
            const linkedPlans = getLinkedPlansForTreatment(tr);
            const isLinked = linkedPlans.length > 0;
            const planNames = linkedPlans.map((p) => p.name).join(', ');

            return (
              <div
                key={`${zone.toLowerCase()}-${quadrant.toLowerCase()}-${tr.toothNumber}-${tr.surface}-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: chipBg,
                  border: isLinked
                    ? '1px solid rgba(245, 158, 11, 0.55)'
                    : `1px solid ${chipBorder}`,
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11.5px',
                  color: chipColor,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '2px',
                    backgroundColor: tr.color,
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>T{tr.toothNumber}</strong> (
                  {getSurfaceDisplayName(tr.surface, tr.toothNumber)}):{' '}
                  <strong>{tr.treatmentName}</strong>
                </span>
                {isLinked && (
                  <Tooltip
                    content={t(
                      'patientOdontogram.linkedBadgeTooltip',
                      'Linked to {{plans}} — remove from Treatment Plan first to clear',
                      { plans: planNames }
                    )}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#d97706',
                        flexShrink: 0,
                      }}
                    >
                      <Lock size={11} />
                    </span>
                  </Tooltip>
                )}
                {canModify && (
                  <Tooltip
                    content={
                      isLinked
                        ? t(
                            'patientOdontogram.linkedBadgeTooltip',
                            'Linked to {{plans}} — remove from Treatment Plan first to clear',
                            { plans: planNames }
                          )
                        : t('patientOdontogram.removeChipTooltip', 'Remove treatment')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveTreatment(tr)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isLinked ? '#b45309' : chipColor,
                        cursor: 'pointer',
                        padding: '2px',
                        marginLeft: '1px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label={t('patientOdontogram.removeChipTooltip', 'Remove treatment')}
                    >
                      <X size={12} />
                    </button>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
        {/* Top Info Row: Patient Metadata on Left, Back to Patient on Right */}
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
                backgroundColor: 'rgba(20, 184, 166, 0.12)',
                color: 'var(--primary-600, #0d9488)',
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
                  {t('patientOdontogram.pageTitle', 'Patient Odontogram')}
                </h1>
                <span
                  style={{
                    backgroundColor: 'rgba(20, 184, 166, 0.12)',
                    color: 'var(--primary-700, #0f766e)',
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
                  {t('patientOdontogram.patient', 'Patient:')} <strong style={{ color: '#1e293b' }}>{patientFullName}</strong>
                </span>
                <span>
                  {t('patientOdontogram.doctor', 'Doctor:')} <strong style={{ color: '#1e293b' }}>Dr. Robert Smith</strong>
                </span>
                {data.patient.branch && (
                  <span style={{ color: 'var(--primary-600, #0d9488)', fontWeight: 600 }}>
                    {data.patient.branch.name}
                  </span>
                )}
                <span style={{ color: '#94a3b8' }}>
                  {t('patientOdontogram.lastSaved', 'Last saved:')} {formatLastSaved(lastSavedTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Back to Patient Button */}
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/clinic/patients')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={16} />
              <span>{t('patientOdontogram.backToPatient', 'Back to Patient')}</span>
            </button>
          </div>
        </div>

        {/* Controls Row: Teeth Model Switcher on Left, Action Buttons ALIGNED TO RIGHT */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Left: Teeth Model Switcher Pills */}
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
                backgroundColor: localTeethModel === 'ADULT' ? 'var(--primary-600, #0d9488)' : 'transparent',
                color: localTeethModel === 'ADULT' ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              {t('patientOdontogram.models.adult', 'Adult (32)')}
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
                backgroundColor: localTeethModel === 'CHILD' ? 'var(--primary-600, #0d9488)' : 'transparent',
                color: localTeethModel === 'CHILD' ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              {t('patientOdontogram.models.child', 'Child (20)')}
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
                backgroundColor: localTeethModel === 'COMPLETE' ? 'var(--primary-600, #0d9488)' : 'transparent',
                color: localTeethModel === 'COMPLETE' ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              {t('patientOdontogram.models.complete', 'Complete (52)')}
            </button>
          </div>

          {/* Right: Actions Aligned to the Right (Treatment Plan + Save Odontogram) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {hasSavedTreatmentPlan && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/clinic/patients/${patientId}/treatment-plan`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--primary-300, #5eead4)',
                  backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
                  color: 'var(--primary-700, #0f766e)',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileSpreadsheet size={16} />
                <span>{t('patientOdontogram.viewTreatmentPlan', 'Treatment Plan')}</span>
              </button>
            )}

            {canModify && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveOdontogram}
                disabled={savingAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: savingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {savingAll ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
                <span>{savingAll ? t('common.saving', 'Saving...') : t('patientOdontogram.saveOdontogram', 'Save Odontogram')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs Bar (Diagnostics and Treatments) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          paddingBottom: '2px',
          overflowX: 'auto',
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Activity size={17} style={{ color: activeTab === 'DIAGNOSTICS' ? '#0284c7' : '#94a3b8' }} />
          <span>{t('patientOdontogram.tabs.diagnostics', 'Diagnostics')}</span>
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

        {/* Tab 2: Treatments */}
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Layers size={17} style={{ color: activeTab === 'TREATMENT' ? '#0284c7' : '#94a3b8' }} />
          <span>{t('patientOdontogram.tabs.treatment', 'Treatments')}</span>
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
              {t('patientOdontogram.diagnosticsHint', 'Click a tooth block to mark its diagnostic condition. Conditions with "Whole" badge apply to the entire tooth.')}
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
                <span>{t('patientOdontogram.clear', 'Clear')}</span>
              </button>

              {/* Dynamic Diagnostic Pills */}
              {dynamicDiagnostics.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#64748b',
                    fontSize: '13px',
                    padding: '4px 8px',
                  }}
                >
                  <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{t('patientOdontogram.noDiagnostics', 'No diagnostics configured in Odontogram Settings.')}</span>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => navigate('/clinic/configurations/odontogram-settings')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        textDecoration: 'underline',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {t('patientOdontogram.configureSettings', 'Configure Settings')}
                    </button>
                  )}
                </div>
              ) : (
                dynamicDiagnostics.map((condition) => {
                  const isSelected =
                    activeDiagBrush !== 'CLEAR' && activeDiagBrush.name === condition.name;

                  return (
                    <button
                      key={condition.id || condition.name}
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
                          {t('patientOdontogram.whole', 'Whole')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
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

          {/* Applied Findings & Markings (Full Width) */}
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
                {t('patientOdontogram.appliedFindings', 'Applied Findings & Markings')} ({findings.length})
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
                  <span>{t('patientOdontogram.clearAll', 'Clear All')}</span>
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
                  {t('patientOdontogram.noFindingsYet', 'No findings or markings applied yet. Click any tooth block above to mark diagnostic conditions.')}
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
              {t('patientOdontogram.treatmentHint', 'Click a tooth block or surface to assign treatment procedures. The applied treatments will populate the corresponding quadrant below.')}
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
                <span>{t('patientOdontogram.clear', 'Clear')}</span>
              </button>

              {/* Dynamic Treatment Pills from Odontogram Settings */}
              {dynamicTreatments.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#64748b',
                    fontSize: '13px',
                    padding: '4px 8px',
                  }}
                >
                  <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{t('patientOdontogram.noTreatments', 'No treatments configured in Odontogram Settings.')}</span>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => navigate('/clinic/configurations/odontogram-settings')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        textDecoration: 'underline',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {t('patientOdontogram.configureSettings', 'Configure Settings')}
                    </button>
                  )}
                </div>
              ) : (
                dynamicTreatments.map((treatment) => {
                  const isSelected =
                    activeTreatBrush !== 'CLEAR' && activeTreatBrush.name === treatment.name;

                  return (
                    <button
                      key={treatment.id || treatment.name}
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
                          {t('patientOdontogram.whole', 'Whole')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
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

          {/* ─── QUADRANT VIEW: ZONA POSTERIOR & ZONA ANTERIOR ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
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
                {t('patientOdontogram.zonaPosterior', 'ZONA POSTERIOR')}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                {renderQuadrantBox('POSTERIOR', 'Q1', false)}
                {renderQuadrantBox('POSTERIOR', 'Q2', true)}
                {renderQuadrantBox('POSTERIOR', 'Q3', false)}
                {renderQuadrantBox('POSTERIOR', 'Q4', true)}
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
                {t('patientOdontogram.zonaAnterior', 'ZONA ANTERIOR')}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                {renderQuadrantBox('ANTERIOR', 'Q1', false)}
                {renderQuadrantBox('ANTERIOR', 'Q2', true)}
                {renderQuadrantBox('ANTERIOR', 'Q3', false)}
                {renderQuadrantBox('ANTERIOR', 'Q4', true)}
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
              ? t('patientOdontogram.savingChanges', 'Saving changes...')
              : `${t('patientOdontogram.lastSaved', 'Last saved:')} ${formatLastSaved(lastSavedTime)}`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/clinic/patients')}
            style={{ fontSize: '13px', height: '40px', padding: '0 16px' }}
          >
            <ArrowLeft size={16} style={{ marginRight: '6px' }} />
            {t('patientOdontogram.backToPatient', 'Back to Patient')}
          </button>

          {hasSavedTreatmentPlan && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/clinic/patients/${patientId}/treatment-plan`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--primary-300, #5eead4)',
                backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
                color: 'var(--primary-700, #0f766e)',
                transition: 'all 0.15s ease',
              }}
            >
              <FileSpreadsheet size={16} />
              <span>{t('patientOdontogram.viewTreatmentPlan', 'Treatment Plan')}</span>
            </button>
          )}

          {canModify && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveOdontogram}
              disabled={savingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 24px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: savingAll ? 'not-allowed' : 'pointer',
              }}
            >
              {savingAll ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
              <span>{t('patientOdontogram.saveOdontogram', 'Save Odontogram')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Linked Treatment Protection Popup Modal ─── */}
      {linkedBlockModal && (
        <div
          className="modal-backdrop"
          onClick={() => setLinkedBlockModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#fef3c7',
                    color: '#d97706',
                    border: '1px solid #fcd34d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lock size={19} />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 800,
                    color: 'var(--text-heading, #0f172a)',
                  }}
                >
                  {linkedBlockModal.actionType === 'replace'
                    ? t(
                        'patientOdontogram.linkedTreatmentModal.titleReplace',
                        'Cannot Replace Linked Treatment'
                      )
                    : t(
                        'patientOdontogram.linkedTreatmentModal.titleClear',
                        'Cannot Remove Linked Treatment'
                      )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLinkedBlockModal(null)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                aria-label={t('common.close', 'Close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '18px 20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  lineHeight: 1.55,
                  color: 'var(--text-body, #334155)',
                }}
              >
                {linkedBlockModal.actionType === 'replace'
                  ? t(
                      'patientOdontogram.linkedTreatmentModal.descriptionReplace',
                      'This treatment cannot be replaced directly on the Odontogram because it is linked to an existing Treatment Plan:'
                    )
                  : t(
                      'patientOdontogram.linkedTreatmentModal.descriptionClear',
                      'This treatment cannot be cleared or removed directly from the Odontogram because it is linked to an existing Treatment Plan:'
                    )}
              </p>

              {/* Affected Treatments List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {linkedBlockModal.blockedItems.map((item, idx) => (
                  <div
                    key={`${item.toothNumber}-${item.surface}-${idx}`}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.06)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '3px',
                            backgroundColor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: 'var(--text-heading, #0f172a)',
                          }}
                        >
                          {item.treatmentName}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                        }}
                      >
                        T{item.toothNumber} · {getSurfaceDisplayName(item.surface, item.toothNumber)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: '#64748b',
                        }}
                      >
                        {t(
                          'patientOdontogram.linkedTreatmentModal.linkedPlansLabel',
                          'Linked Treatment Plan'
                        )}
                        :
                      </span>
                      {item.plans.map((plan) => {
                        const meta = PLAN_STATUS_META[plan.status] || PLAN_STATUS_META.CREATED;
                        const statusLabel = t(
                          `patientTreatmentPlan.${meta.labelKey}`,
                          meta.defaultLabel
                        );
                        return (
                          <span
                            key={`${plan.id}-${plan.name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              backgroundColor: meta.bg,
                              color: meta.color,
                              border: `1px solid ${meta.border}`,
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            <span>{plan.name}</span>
                            <span style={{ opacity: 0.7 }}>·</span>
                            <span>{statusLabel}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Guidance Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '9px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  color: '#0f766e',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>
                    {t(
                      'patientOdontogram.linkedTreatmentModal.howToRemoveHint',
                      'To clear or modify this treatment, open the Treatment Plan page, remove the service from the linked plan and save the plan, then return to the Odontogram.'
                    )}
                  </span>
                  {linkedBlockModal.isBulkQuadrant && (
                    <span style={{ fontSize: '11.5px', color: '#115e59', fontWeight: 600 }}>
                      {t(
                        'patientOdontogram.linkedTreatmentModal.quadrantClearHint',
                        'Tip: Unlinked treatments in this quadrant can still be removed individually using their remove (×) button.'
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setLinkedBlockModal(null);
                  navigate(`/clinic/patients/${patientId}/treatment-plan`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  minHeight: '42px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid var(--primary-300, #5eead4)',
                  backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
                  color: 'var(--primary-700, #0f766e)',
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={15} />
                <span>
                  {t(
                    'patientOdontogram.linkedTreatmentModal.goToTreatmentPlan',
                    'Go to Treatment Plan'
                  )}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setLinkedBlockModal(null)}
                style={{
                  minHeight: '42px',
                  padding: '0 22px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('patientOdontogram.linkedTreatmentModal.understood', 'Understood')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
