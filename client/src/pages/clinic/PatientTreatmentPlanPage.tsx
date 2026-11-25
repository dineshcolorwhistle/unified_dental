import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LayoutGrid,
  User,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Calendar,
  Save,
  Check,
  Layers,
  X,
  FileText,
  Clock,
  Printer,
  AlertTriangle,
  Pill,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Info,
  Stethoscope,
  History,
  CalendarCheck,
  Edit2,
} from 'lucide-react';
import api from '../../services/api';
import { Tooltip } from '../../components/common/Tooltip';
import { useAuth } from '../../core/context/AuthContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { ToothIcon } from '../../components/common/ToothIcon';
import { AddPatientNoteModal, PatientOptionItem } from '../../components/clinic/AddPatientNoteModal';
import { TreatmentPlanPrintView } from '../../components/clinic/TreatmentPlanPrintView';
import { TreatmentPlanAuditModal } from '../../components/clinic/TreatmentPlanAuditModal';
import { EditAppointmentDropdown } from '../../components/clinic/EditAppointmentDropdown';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { useToast } from '../../core/context/ToastContext';
import {
  clinicOdontogramService,
  PatientOdontogramResponse,
  PatientOdontogramTreatmentItem,
  LinkedPlanAppointment,
} from '../../services/clinicOdontogramService';
import { clinicServiceService, ClinicServiceItem } from '../../services/clinicServiceService';
import {
  getToothZoneAndQuadrant,
  getSurfaceDisplayName,
  ToothZone,
  ToothQuadrant,
} from '../../components/clinic/PatientTeethChart';

export type TreatmentPlanStatus =
  | 'CREATED'
  | 'PRESENTED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export const STATUS_CONFIG: Record<
  TreatmentPlanStatus,
  { labelKey: string; defaultLabel: string; bg: string; color: string; border: string }
> = {
  CREATED: {
    labelKey: 'statusCreated',
    defaultLabel: 'Created',
    bg: 'rgba(59, 130, 246, 0.1)',
    color: '#1d4ed8',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  PRESENTED: {
    labelKey: 'statusPresented',
    defaultLabel: 'Presented',
    bg: 'rgba(99, 102, 241, 0.1)',
    color: '#4338ca',
    border: 'rgba(99, 102, 241, 0.3)',
  },
  ACCEPTED: {
    labelKey: 'statusAccepted',
    defaultLabel: 'Accepted',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#047857',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  IN_PROGRESS: {
    labelKey: 'statusInProgress',
    defaultLabel: 'In Progress',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#b45309',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  COMPLETED: {
    labelKey: 'statusCompleted',
    defaultLabel: 'Completed',
    bg: 'rgba(13, 148, 136, 0.12)',
    color: '#0f766e',
    border: 'rgba(13, 148, 136, 0.35)',
  },
  CANCELLED: {
    labelKey: 'statusCancelled',
    defaultLabel: 'Cancelled',
    bg: 'rgba(100, 116, 139, 0.12)',
    color: '#475569',
    border: 'rgba(100, 116, 139, 0.3)',
  },
  REJECTED: {
    labelKey: 'statusRejected',
    defaultLabel: 'Rejected',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#b91c1c',
    border: 'rgba(239, 68, 68, 0.35)',
  },
};

export interface ProposedItem {
  id: string;
  treatmentName: string;
  otTeethNumber?: string;
  color?: string;
  zone?: ToothZone;
  quadrant?: ToothQuadrant;
  zoneText?: string;
  toothNumbers: number[];
  quantity: number;
  doctorId: string;
  serviceId: string;
  unitPrice: number;
  subtotal: number;
  isSelected?: boolean;
}

export interface ProposedGroup {
  id: string;
  name: string;
  status: TreatmentPlanStatus;
  confirmed: boolean;
  items: ProposedItem[];
}

export interface DoctorWithServices {
  id: string;
  name: string;
  email?: string;
  specialization?: string;
  services?: Array<{
    serviceId: string;
    serviceName?: string;
    customPrice?: number;
    basePrice?: number;
  }>;
}

export interface DoctorApptSchedule {
  doctorId: string;
  doctorName: string;
  services: ProposedItem[];
  selected: boolean;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: string;
  reason: string;
  notes: string;
  availableSlots: Array<{ startTime: string; endTime: string; available: boolean }>;
  loadingSlots: boolean;
  status: 'idle' | 'saving' | 'success' | 'error';
  errorMessage?: string;
  appointmentId?: string;
}

export const PatientTreatmentPlanPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { error, success } = useToast();
  const { user, isTenantAdmin, isClinicAdmin, isClinicDoctor } = useAuth();
  const { socket } = useNotifications();
  const canEditPlan = (isClinicAdmin || isClinicDoctor || Boolean(user?.isSuperAdmin)) && !isTenantAdmin;

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PatientOdontogramResponse | null>(null);

  // View Mode: 'plan' (interactive plan view) or 'print-preview' (full-page print preview)
  const [viewMode, setViewMode] = useState<'plan' | 'print-preview'>('plan');

  // Doctors & Services state
  const [doctors, setDoctors] = useState<DoctorWithServices[]>([]);
  const [clinicServices, setClinicServices] = useState<ClinicServiceItem[]>([]);

  // Proposed Treatment Plan state
  const [planGroups, setPlanGroups] = useState<ProposedGroup[]>([]);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [statusSavingGroupIds, setStatusSavingGroupIds] = useState<Record<string, boolean>>({});
  const [openEditDropdownGroupId, setOpenEditDropdownGroupId] = useState<string | null>(null);

  // Audit History Modal state
  const [auditModalState, setAuditModalState] = useState<{ isOpen: boolean; groupId: string }>({
    isOpen: false,
    groupId: 'ALL',
  });

  // Pre-appointment Service Completeness Validation Alert Modal state
  const [validationAlertData, setValidationAlertData] = useState<{
    title: string;
    instruction: string;
    emptyPlan?: boolean;
    invalidRows: Array<{
      rowNumber: number;
      itemId: string;
      treatmentName: string;
      isEmptyRow: boolean;
      missingFields: string[];
    }>;
  } | null>(null);
  const [invalidItemIds, setInvalidItemIds] = useState<Set<string>>(new Set());

  // Context of active booking (group vs single-service) for linkage on appointment creation
  const [activeBookingContext, setActiveBookingContext] = useState<{
    groupId: string;
    groupName: string;
    scope: 'GROUP' | 'ITEM';
  } | null>(null);

  // Drag and Drop state (Supports single, multi-row, and within-plan reorder)
  const [draggedItems, setDraggedItems] = useState<{ itemIds: string[]; sourceGroupId: string } | null>(null);
  const [draggedRow, setDraggedRow] = useState<{ groupId: string; itemId: string; index: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ groupId: string; index: number } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Add Note Modal state (Opens existing notes & clinical note creator)
  const [isAddNoteOpen, setIsAddNoteOpen] = useState<boolean>(false);

  // Appointment Modal state
  const [isApptModalOpen, setIsApptModalOpen] = useState<boolean>(false);
  const [apptSubmitting, setApptSubmitting] = useState<boolean>(false);
  const [apptForm, setApptForm] = useState<{
    doctorId: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    type: string;
    reason: string;
    notes: string;
  }>({
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    durationMinutes: 30,
    type: 'PROCEDURE',
    reason: '',
    notes: '',
  });

  // Multi-doctor Appointment Schedule state
  const [multiDoctorAppts, setMultiDoctorAppts] = useState<DoctorApptSchedule[]>([]);
  const [isMultiDoctorModal, setIsMultiDoctorModal] = useState<boolean>(false);
  const [activeDocTabIdx, setActiveDocTabIdx] = useState<number>(0);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  // Single-mode slot state
  const [singleSlots, setSingleSlots] = useState<Array<{ startTime: string; endTime: string; available: boolean }>>([]);
  const [singleSlotsLoading, setSingleSlotsLoading] = useState<boolean>(false);

  // Responsive mobile tracking for appointment modal (< 768px)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });
  const [activeApptMobileTab, setActiveApptMobileTab] = useState<'form' | 'slots'>('form');

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Delete Plan Confirmation state
  const [planToDelete, setPlanToDelete] = useState<ProposedGroup | null>(null);

  // Collapsible Summary Section (Collapsed by default per user specification)
  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(false);

  // Interactive View Controls
  const [selectedTreatment, setSelectedTreatment] = useState<string>('all');

  const fetchPlanData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!patientId) return;
      if (!options?.silent) setLoading(true);
      try {
        const res = await clinicOdontogramService.getPatientOdontogram(patientId);
        setData(res);
      } catch (err: any) {
        console.error('Failed to load treatment plan data:', err);
        error(
          err.response?.data?.message ||
            t('patientTreatmentPlan.loadFailed', 'Failed to load patient treatment plan data.')
        );
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [patientId, t, error]
  );

  const fetchDoctorsAndServices = useCallback(async () => {
    try {
      const [docRes, srvRes] = await Promise.all([
        api.get('/clinic/users/doctors'),
        clinicServiceService.getAll({ status: 'ACTIVE' }),
      ]);
      const docs = Array.isArray(docRes.data) ? docRes.data : docRes.data?.data || [];
      setDoctors(docs);
      setClinicServices(srvRes || []);
    } catch (err) {
      console.error('Failed to load clinic doctors/services:', err);
    }
  }, []);

  useEffect(() => {
    fetchPlanData();
    fetchDoctorsAndServices();
  }, [fetchPlanData, fetchDoctorsAndServices]);

  // Real-time WebSocket sync when status or appointments update elsewhere
  useEffect(() => {
    if (!socket || !patientId) return;
    const handlePlanUpdated = (payload: any) => {
      if (!payload?.patientId || payload.patientId === patientId) {
        fetchPlanData({ silent: true });
      }
    };
    socket.on('treatment_plan:updated', handlePlanUpdated);
    return () => {
      socket.off('treatment_plan:updated', handlePlanUpdated);
    };
  }, [socket, patientId, fetchPlanData]);

  // Derived active linked appointments lookup maps
  const linkedAppointments = useMemo<LinkedPlanAppointment[]>(
    () => data?.linkedAppointments || [],
    [data?.linkedAppointments]
  );

  const activeLinkedAppointments = useMemo<LinkedPlanAppointment[]>(
    () => linkedAppointments.filter((apt) => apt.status !== 'CANCELLED'),
    [linkedAppointments]
  );

  const activeGroupAppointmentsMap = useMemo(() => {
    const map = new Map<string, LinkedPlanAppointment[]>();
    activeLinkedAppointments.forEach((apt) => {
      if (!apt.treatmentPlanGroupId) return;
      const list = map.get(apt.treatmentPlanGroupId) || [];
      list.push(apt);
      map.set(apt.treatmentPlanGroupId, list);
    });
    return map;
  }, [activeLinkedAppointments]);

  const activeItemAppointmentMap = useMemo(() => {
    const map = new Map<string, LinkedPlanAppointment>();
    activeLinkedAppointments.forEach((apt) => {
      const ids = Array.isArray(apt.treatmentPlanItemIds) ? apt.treatmentPlanItemIds : [];
      ids.forEach((id) => {
        if (id) map.set(String(id), apt);
      });
    });
    return map;
  }, [activeLinkedAppointments]);

  const patient = data?.patient;
  const patientFullName = patient
    ? [patient.firstName, patient.fatherLastName, patient.motherLastName]
        .filter(Boolean)
        .join(' ')
    : '';

  const treatments = useMemo<PatientOdontogramTreatmentItem[]>(() => {
    return data?.treatments || [];
  }, [data?.treatments]);

  const patientListForModal = useMemo<PatientOptionItem[]>(() => {
    if (!patient) return [];
    return [
      {
        id: patient.id,
        recordNumber: patient.recordNumber,
        firstName: patient.firstName,
        fatherLastName: patient.fatherLastName,
        motherLastName: patient.motherLastName,
        phoneCountryCode: patient.phoneCountryCode,
        phoneNumber: patient.phoneNumber,
      },
    ];
  }, [patient]);

  const doctorOptions: SearchableSelectOption[] = useMemo(() => {
    return doctors.map((doc) => ({
      value: doc.id,
      label: doc.name,
      sublabel: doc.specialization || doc.email,
    }));
  }, [doctors]);

  // Initialize proposed plan when data loads
  useEffect(() => {
    if (!data) return;

    const savedPlan = (data.odontogram as any)?.proposedPlan;
    if (savedPlan && Array.isArray(savedPlan.groups) && savedPlan.groups.length > 0) {
      setPlanGroups((prev) => {
        const selectedMap = new Map<string, boolean>();
        prev.forEach((pg) => pg.items.forEach((pi) => selectedMap.set(pi.id, Boolean(pi.isSelected))));
        return savedPlan.groups.map((g: any, gIdx: number) => ({
          ...g,
          id: g.id || `group-${gIdx + 1}`,
          name: g.name ? g.name.replace(/^Visit\s*/i, 'Plan ') : `Plan ${gIdx + 1}`,
          status: (g.status as TreatmentPlanStatus) || (g.confirmed ? 'ACCEPTED' : 'CREATED'),
          items: Array.isArray(g.items)
            ? g.items.map((it: any) => ({
                ...it,
                isSelected: selectedMap.get(it.id) ?? Boolean(it.isSelected),
                otTeethNumber:
                  it.otTeethNumber !== undefined
                    ? it.otTeethNumber
                    : it.toothNumbers?.length
                    ? it.toothNumbers.join(', ')
                    : '',
              }))
            : [],
        }));
      });
      return;
    }

    // Initial state: always start with only the first Treatment Plan (Plan 1) without any services.
    // Admins add treatments explicitly via "+ Add Service" from the Odontogram treatments dropdown.
    setPlanGroups([
      {
        id: 'group-1',
        name: 'Plan 1',
        status: 'CREATED',
        confirmed: false,
        items: [],
      },
    ]);
  }, [data]);

  // Group Management Handlers
  const handleAddPlanGroup = () => {
    const nextNum = planGroups.length + 1;
    setPlanGroups((prev) => [
      ...prev,
      {
        id: `group-${Date.now()}`,
        name: `Plan ${nextNum}`,
        status: 'CREATED',
        confirmed: false,
        items: [],
      },
    ]);
  };

  const handleDeleteGroup = (groupId: string) => {
    if ((activeGroupAppointmentsMap.get(groupId) || []).length > 0) return;
    const groupToDelete = planGroups.find((g) => g.id === groupId);
    if (!groupToDelete) return;
    setPlanToDelete(groupToDelete);
  };

  const confirmDeleteGroup = () => {
    if (!planToDelete) return;
    if (planGroups.length <= 1) {
      // If deleting the only plan group, reset it to an empty plan
      setPlanGroups([
        {
          id: `group-${Date.now()}`,
          name: 'Plan 1',
          status: 'CREATED',
          confirmed: false,
          items: [],
        },
      ]);
    } else {
      setPlanGroups((prev) => prev.filter((g) => g.id !== planToDelete.id));
    }
    setPlanToDelete(null);
    success(t('common.deletedSuccess', 'Treatment plan removed successfully.'));
  };

  const handleGroupNameChange = (groupId: string, newName: string) => {
    if ((activeGroupAppointmentsMap.get(groupId) || []).length > 0) return;
    setPlanGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
  };

  const handlePlanStatusChange = async (groupId: string, newStatus: TreatmentPlanStatus) => {
    if (!patientId) return;
    const targetGroup = planGroups.find((g) => g.id === groupId);
    if (!targetGroup || targetGroup.status === newStatus) return;

    const previousGroups = planGroups;
    const isConfirmed =
      newStatus === 'ACCEPTED' || newStatus === 'IN_PROGRESS' || newStatus === 'COMPLETED';
    const nextGroups = planGroups.map((g) =>
      g.id === groupId ? { ...g, status: newStatus, confirmed: isConfirmed } : g
    );

    // Optimistically update UI immediately without waiting for Save Plan or page reload
    setPlanGroups(nextGroups);
    setData((prev) =>
      prev
        ? {
            ...prev,
            odontogram: {
              ...prev.odontogram,
              proposedPlan: {
                ...(prev.odontogram?.proposedPlan || {}),
                groups: nextGroups,
                grandTotal: nextGroups.reduce(
                  (gSum, g) => gSum + g.items.reduce((iSum, it) => iSum + (it.subtotal || 0), 0),
                  0
                ),
              },
            },
          }
        : prev
    );

    setStatusSavingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await clinicOdontogramService.updateTreatmentPlanGroupStatus(
        patientId,
        groupId,
        {
          status: newStatus,
          planName: targetGroup.name,
          items: targetGroup.items,
        }
      );
      if (res?.proposedPlan) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                odontogram: {
                  ...prev.odontogram,
                  proposedPlan: res.proposedPlan,
                },
              }
            : prev
        );
      }
      const cfg = STATUS_CONFIG[newStatus];
      const statusLabel = cfg ? t(`patientTreatmentPlan.${cfg.labelKey}`, cfg.defaultLabel) : newStatus;
      success(
        t('patientTreatmentPlan.statusUpdatedSuccess', 'Treatment plan status updated to {{status}}.', {
          status: statusLabel,
        })
      );
    } catch (err: any) {
      console.error('Failed to update treatment plan status:', err);
      setPlanGroups(previousGroups);
      error(
        err?.response?.data?.message ||
          t('patientTreatmentPlan.statusUpdateFailed', 'Failed to update treatment plan status.')
      );
    } finally {
      setStatusSavingGroupIds((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  // Add Service directly to a Group (Services dropdown starts empty until doctor chosen)
  const handleAddServiceToGroup = (groupId: string) => {
    if ((activeGroupAppointmentsMap.get(groupId) || []).length > 0) return;
    const newItem: ProposedItem = {
      id: `custom-srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      treatmentName: '',
      otTeethNumber: '',
      toothNumbers: [],
      quantity: 1,
      doctorId: '',
      serviceId: '',
      unitPrice: 0,
      subtotal: 0,
      isSelected: false,
    };
    setPlanGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, items: [...g.items, newItem] } : g))
    );
  };

  // Remove individual Service from a Group
  const handleRemoveServiceFromGroup = (groupId: string, itemId: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    setInvalidItemIds((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.filter((it) => it.id !== itemId),
        };
      })
    );
  };

  // Status select options for SearchableSelect (Clean text with color dot, no duplicate badge)
  const statusSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return (Object.keys(STATUS_CONFIG) as TreatmentPlanStatus[]).map((st) => {
      const cfg = STATUS_CONFIG[st];
      return {
        value: st,
        label: t(`patientTreatmentPlan.${cfg.labelKey}`, cfg.defaultLabel),
        icon: (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: cfg.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        ),
      };
    });
  }, [t]);

  // Flat list of all items across all groups for duplicate detection
  const allPlanItems = useMemo(() => {
    return planGroups.flatMap((g) => g.items);
  }, [planGroups]);

  const normalizePlanTreatmentName = useCallback((name?: string | null): string => {
    return String(name || '')
      .replace(/\s*\([#\d\s,]+\)/g, '')
      .replace(/#\d+/g, '')
      .trim()
      .toLowerCase();
  }, []);

  const getItemToothNumberSet = useCallback((item: ProposedItem): Set<number> => {
    const teeth = new Set<number>();
    if (Array.isArray(item.toothNumbers)) {
      item.toothNumbers.forEach((n) => {
        const parsed = Number(n);
        if (Number.isInteger(parsed) && parsed > 0) teeth.add(parsed);
      });
    }
    if (item.otTeethNumber) {
      String(item.otTeethNumber)
        .split(/[\s,;]+/)
        .forEach((token) => {
          const cleaned = token.replace(/#/g, '').trim();
          if (!cleaned) return;
          const parsed = Number(cleaned);
          if (Number.isInteger(parsed) && parsed > 0) teeth.add(parsed);
        });
    }
    return teeth;
  }, []);

  // Treatment options for SearchableSelect: display teeth number along with name in dropdown ex: Corona #32, and only treatment name once selected
  const getTreatmentOptionsForItem = useCallback(
    (currentItemId: string, currentTreatmentName: string) => {
      const available: SearchableSelectOption[] = [];
      const alreadyAdded: SearchableSelectOption[] = [];
      const seenKeys = new Set<string>();

      treatments.forEach((tr) => {
        const rawName = tr.treatmentName || tr.treatment?.name || 'Treatment';
        const name = rawName.replace(/\s*\([#\d\s,]+\)/g, '').replace(/#\d+/g, '').trim();
        const normalizedName = normalizePlanTreatmentName(name);
        const toothNum = Number(tr.toothNumber);
        const cleanTooth = String(toothNum).replace(/#/g, '').trim();
        const dedupeKey = `${normalizedName}__${cleanTooth}`;
        if (seenKeys.has(dedupeKey)) return;
        seenKeys.add(dedupeKey);

        const val = cleanTooth ? `${name}__${cleanTooth}` : name;
        const optionLabel = cleanTooth ? `${name} #${cleanTooth}` : name;
        const selectedTriggerLabel = name;

        const isUsedElsewhere = allPlanItems.some(
          (it) =>
            it.id !== currentItemId &&
            normalizePlanTreatmentName(it.treatmentName) === normalizedName &&
            getItemToothNumberSet(it).has(toothNum)
        );

        if (isUsedElsewhere) {
          alreadyAdded.push({
            value: val,
            label: optionLabel,
            selectedLabel: selectedTriggerLabel,
            badge: t('patientTreatmentPlan.alreadySelected', 'Already selected'),
            badgeBg: 'rgba(239, 68, 68, 0.08)',
            badgeColor: '#dc2626',
            disabled: true,
          });
        } else {
          available.push({
            value: val,
            label: optionLabel,
            selectedLabel: selectedTriggerLabel,
          });
        }
      });

      // Fallback option for custom treatment names or legacy multi-tooth rows
      const cleanCurrentName = currentTreatmentName
        .replace(/\s*\([#\d\s,]+\)/g, '')
        .replace(/#\d+/g, '')
        .trim();
      const currentItem = allPlanItems.find((it) => it.id === currentItemId);
      const currentToothStr = (
        currentItem?.otTeethNumber ||
        (currentItem?.toothNumbers?.[0] ? String(currentItem.toothNumbers[0]) : '')
      )
        .replace(/#/g, '')
        .trim();
      const expectedCurrentVal = currentToothStr
        ? `${cleanCurrentName}__${currentToothStr}`
        : cleanCurrentName;
      const hasExactCurrentMatch = [...available, ...alreadyAdded].some(
        (o) => o.value === expectedCurrentVal || o.value === cleanCurrentName
      );

      if (cleanCurrentName && !hasExactCurrentMatch) {
        available.unshift({
          value: cleanCurrentName,
          label: cleanCurrentName,
          selectedLabel: cleanCurrentName,
        });
      }

      return [...available, ...alreadyAdded];
    },
    [treatments, allPlanItems, normalizePlanTreatmentName, getItemToothNumberSet, t]
  );

  const clearInvalidItem = (itemId: string) => {
    setInvalidItemIds((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleItemTreatmentSelect = (groupId: string, itemId: string, val: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    const parts = val.includes('__') ? val.split('__') : val.split('__#');
    const tName = parts[0].replace(/\s*\([#\d\s,]+\)/g, '').replace(/#\d+/g, '').trim();
    const toothNum = parts[1] ? parseInt(parts[1].replace(/#/g, ''), 10) : undefined;

    const matchedTr = treatments.find(
      (tr) =>
        (tr.treatmentName || tr.treatment?.name || '').replace(/\s*\([#\d\s,]+\)/g, '').replace(/#\d+/g, '').trim() === tName &&
        (toothNum ? tr.toothNumber === toothNum : true)
    );

    const matchedClinicSrv = clinicServices.find(
      (s) => s.name.trim().toLowerCase() === tName.toLowerCase()
    );

    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => {
            if (it.id !== itemId) return it;
            const toothNumbers = toothNum ? [toothNum] : it.toothNumbers;
            const otTeethNumber = toothNum ? String(toothNum) : (it.otTeethNumber || '').replace(/#/g, '');
            const serviceId = it.serviceId || matchedClinicSrv?.id || '';
            const unitPrice = it.unitPrice || (matchedClinicSrv ? Number(matchedClinicSrv.price) : 0);
            return {
              ...it,
              treatmentName: tName,
              otTeethNumber,
              toothNumbers,
              serviceId,
              unitPrice,
              subtotal: it.quantity * unitPrice,
              color: matchedTr?.color || it.color,
            };
          }),
        };
      })
    );
  };

  // Treatment Item Field Handlers
  const handleItemTreatmentNameChange = (groupId: string, itemId: string, name: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => (it.id === itemId ? { ...it, treatmentName: name } : it)),
        };
      })
    );
  };

  const handleItemOtTeethChange = (groupId: string, itemId: string, otVal: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    const parsed = otVal
      .split(/[\s,]+/)
      .map((s) => parseInt(s.replace(/#/g, ''), 10))
      .filter((n) => !isNaN(n) && n >= 11 && n <= 85);

    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  otTeethNumber: otVal,
                  toothNumbers: parsed.length > 0 ? parsed : it.toothNumbers,
                }
              : it
          ),
        };
      })
    );
  };

  const handleItemDoctorChange = (groupId: string, itemId: string, doctorId: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              doctorId,
              serviceId: '',
              unitPrice: 0,
              subtotal: 0,
            };
          }),
        };
      })
    );
  };

  const handleItemServiceChange = (groupId: string, itemId: string, serviceId: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => {
            if (it.id !== itemId) return it;
            const doc = doctors.find((d) => d.id === it.doctorId);
            const docSrv = doc?.services?.find((s) => s.serviceId === serviceId);
            const baseSrv = clinicServices.find((s) => s.id === serviceId);
            const price = Number(docSrv?.customPrice ?? docSrv?.basePrice ?? baseSrv?.price ?? 0);
            const srvName = baseSrv?.name || docSrv?.serviceName || '';
            return {
              ...it,
              serviceId,
              treatmentName: it.treatmentName ? it.treatmentName : srvName,
              unitPrice: price,
              subtotal: it.quantity * price,
            };
          }),
        };
      })
    );
  };

  const handleItemQtyChange = (groupId: string, itemId: string, qtyRaw: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    const qty = Math.max(1, parseInt(qtyRaw) || 1);
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              quantity: qty,
              subtotal: qty * it.unitPrice,
            };
          }),
        };
      })
    );
  };

  const handleItemUnitPriceChange = (groupId: string, itemId: string, priceRaw: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    clearInvalidItem(itemId);
    const price = Math.max(0, parseFloat(priceRaw) || 0);
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              unitPrice: price,
              subtotal: it.quantity * price,
            };
          }),
        };
      })
    );
  };

  const handleItemSelectionToggle = (groupId: string, itemId: string) => {
    if (activeItemAppointmentMap.has(itemId)) return;
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => (it.id === itemId ? { ...it, isSelected: !it.isSelected } : it)),
        };
      })
    );
  };

  const handleGroupSelectAllToggle = (groupId: string, selectAll: boolean) => {
    if ((activeGroupAppointmentsMap.get(groupId) || []).length > 0) return;
    setPlanGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) => ({ ...it, isSelected: selectAll })),
        };
      })
    );
  };

  // Move Multiple Items Between Groups (Supports single or batch transfer)
  const handleMoveItems = (itemIds: string[], sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId || !itemIds.length) return;
    if ((activeGroupAppointmentsMap.get(targetGroupId) || []).length > 0) return;
    const unlockedIds = itemIds.filter((id) => !activeItemAppointmentMap.has(id));
    if (!unlockedIds.length) return;
    setPlanGroups((prev) => {
      const itemsToMove: ProposedItem[] = [];
      const updated = prev.map((g) => {
        if (g.id === sourceGroupId) {
          const remaining: ProposedItem[] = [];
          g.items.forEach((it) => {
            if (unlockedIds.includes(it.id)) {
              itemsToMove.push({ ...it, isSelected: false });
            } else {
              remaining.push(it);
            }
          });
          return { ...g, items: remaining };
        }
        return g;
      });

      if (!itemsToMove.length) return prev;

      return updated.map((g) => {
        if (g.id === targetGroupId) {
          return { ...g, items: [...g.items, ...itemsToMove] };
        }
        return g;
      });
    });
  };

  // Grand Total calculation
  const grandTotal = useMemo(() => {
    return planGroups.reduce(
      (gSum, g) => gSum + g.items.reduce((iSum, it) => iSum + (it.subtotal || 0), 0),
      0
    );
  }, [planGroups]);

  // Save Plan
  const handleSavePlan = async () => {
    if (!patientId) return;
    setSavingPlan(true);
    try {
      await clinicOdontogramService.saveProposedTreatmentPlan(patientId, {
        groups: planGroups,
        grandTotal,
      });
      await fetchPlanData({ silent: true });
      success(t('patientTreatmentPlan.planSavedSuccess', 'Treatment plans saved successfully.'));
    } catch (err: any) {
      console.error('Failed to save proposed plan:', err);
      error(
        err.response?.data?.message ||
          t('patientTreatmentPlan.planSaveFailed', 'Failed to save treatment plan.')
      );
    } finally {
      setSavingPlan(false);
    }
  };

  // Pre-appointment completeness validation (checks all rows at plan level, or target row at item level)
  const validateItemsForAppointment = (
    itemsToCheck: ProposedItem[],
    scope: 'GROUP' | 'ITEM',
    allGroupItems: ProposedItem[]
  ): boolean => {
    if (scope === 'GROUP' && allGroupItems.length === 0) {
      setInvalidItemIds(new Set());
      setValidationAlertData({
        title: t('patientTreatmentPlan.validationPopupTitle', 'Complete Required Service Fields'),
        instruction: t(
          'patientTreatmentPlan.validationNoServices',
          "This treatment plan has no services yet. Click '+ Add Service' and fill in all required columns before creating an appointment."
        ),
        emptyPlan: true,
        invalidRows: [],
      });
      return false;
    }

    const invalidRows: Array<{
      rowNumber: number;
      itemId: string;
      treatmentName: string;
      isEmptyRow: boolean;
      missingFields: string[];
    }> = [];
    const badIds = new Set<string>();

    itemsToCheck.forEach((it) => {
      const rowIdx = allGroupItems.findIndex((gItem) => gItem.id === it.id);
      const rowNumber = rowIdx >= 0 ? rowIdx + 1 : 1;

      const hasTreatment = Boolean(it.treatmentName && it.treatmentName.trim());
      const hasDoctor = Boolean(it.doctorId);
      const hasService = Boolean(it.serviceId);
      const hasQty = Boolean(it.quantity && Number(it.quantity) >= 1);
      const hasPrice = it.unitPrice !== undefined && it.unitPrice !== null && Number(it.unitPrice) > 0;

      const missingFields: string[] = [];
      if (!hasTreatment) missingFields.push(t('patientTreatmentPlan.validationFieldTreatment', 'Treatment'));
      if (!hasDoctor) missingFields.push(t('patientTreatmentPlan.validationFieldDoctor', 'Doctor'));
      if (!hasService) missingFields.push(t('patientTreatmentPlan.validationFieldService', 'Service'));
      if (!hasQty) missingFields.push(t('patientTreatmentPlan.validationFieldQty', 'Qty (min 1)'));
      if (!hasPrice) missingFields.push(t('patientTreatmentPlan.validationFieldPrice', 'Price (MXN > 0)'));

      if (missingFields.length > 0) {
        badIds.add(it.id);
        invalidRows.push({
          rowNumber,
          itemId: it.id,
          treatmentName: it.treatmentName?.trim() || '',
          isEmptyRow: !hasTreatment && !hasDoctor && !hasService,
          missingFields,
        });
      }
    });

    if (invalidRows.length > 0) {
      setInvalidItemIds(badIds);
      setValidationAlertData({
        title: t('patientTreatmentPlan.validationPopupTitle', 'Complete Required Service Fields'),
        instruction:
          scope === 'GROUP'
            ? t(
                'patientTreatmentPlan.validationPopupPlanInstruction',
                'All service rows in this treatment plan must have every required field filled before creating an appointment. Please complete the missing fields below or remove any empty rows.'
              )
            : t(
                'patientTreatmentPlan.validationPopupRowInstruction',
                'Please fill in all required fields for this service before scheduling an appointment.'
              ),
        invalidRows,
      });
      return false;
    }

    setInvalidItemIds(new Set());
    return true;
  };

  // Helper: Format services as numbered list for appointment notes
  const formatServicesForNotes = (services: ProposedItem[]): string => {
    return services
      .map((it, idx) => {
        const name = it.treatmentName || 'Treatment';
        const teeth = it.otTeethNumber
          ? ` (OT: ${it.otTeethNumber})`
          : it.toothNumbers && it.toothNumbers.length > 0
          ? ` (#${it.toothNumbers.join(', #')})`
          : '';
        return `${idx + 1}. ${name}${teeth}`;
      })
      .join('\n');
  };

  // Helper: Calculate end time from start + duration
  const calculateEndTime = (start: string, durationMins: number): string => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const total = h * 60 + m + durationMins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  // Helper: Fetch available slots for a doctor/date/duration
  const fetchAvailableSlots = async (docId: string, dateStr: string, duration: number) => {
    if (!docId || !dateStr) return [];
    try {
      const res = await api.get(
        `/clinic/appointments/working-hours/available-slots?doctorId=${docId}&date=${dateStr}&durationMinutes=${duration}`
      );
      const raw = res.data?.slots || [];
      return Array.isArray(raw)
        ? raw.map((s: any) =>
            typeof s === 'string'
              ? { startTime: s, endTime: calculateEndTime(s, duration), available: true }
              : { startTime: s.startTime, endTime: s.endTime, available: s.available !== false }
          )
        : [];
    } catch (err) {
      console.error('Failed to fetch available slots:', err);
      return [];
    }
  };

  // Load slots for single-mode
  const loadSingleSlots = async (docId: string, dateStr: string, duration: number) => {
    setSingleSlotsLoading(true);
    const slots = await fetchAvailableSlots(docId, dateStr, duration);
    setSingleSlots(slots);
    setSingleSlotsLoading(false);
  };

  // Load slots for a multi-doctor tab
  const loadMultiSlots = async (index: number, docId: string, dateStr: string, duration: number) => {
    setMultiDoctorAppts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], loadingSlots: true };
      return copy;
    });
    const slots = await fetchAvailableSlots(docId, dateStr, duration);
    setMultiDoctorAppts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], availableSlots: slots, loadingSlots: false };
      return copy;
    });
  };

  // Open Appointment Modal for a Group (Auto-divides across multiple doctors)
  const handleOpenApptModalForGroup = (group: ProposedGroup) => {
    if ((group.status || 'CREATED') !== 'ACCEPTED') {
      return;
    }

    // Validate ALL services in the treatment plan have all required fields filled
    if (!validateItemsForAppointment(group.items, 'GROUP', group.items)) {
      return;
    }

    // Filter out already scheduled services so only unscheduled services are booked
    const unscheduledItems = group.items.filter((it) => !activeItemAppointmentMap.has(it.id));
    if (unscheduledItems.length === 0) {
      return;
    }

    const selectedItems = unscheduledItems.filter((it) => it.isSelected);
    const targetItems = selectedItems.length > 0 ? selectedItems : unscheduledItems;

    // Group items by doctorId — IGNORE services without an assigned doctor
    const doctorMap = new Map<string, ProposedItem[]>();
    let ignoredCount = 0;
    targetItems.forEach((it) => {
      if (!it.doctorId) {
        ignoredCount++;
        return;
      }
      // Auto-resolve missing serviceId by matching treatmentName against clinicServices
      let itemToUse = it;
      if (!it.serviceId && it.treatmentName) {
        const matched = clinicServices.find(
          (cs) => cs.name?.toLowerCase().trim() === it.treatmentName?.toLowerCase().trim()
        );
        if (matched) {
          itemToUse = { ...it, serviceId: matched.id };
        }
      }
      if (!doctorMap.has(itemToUse.doctorId)) {
        doctorMap.set(itemToUse.doctorId, []);
      }
      doctorMap.get(itemToUse.doctorId)!.push(itemToUse);
    });

    setUnassignedCount(ignoredCount);

    // If NO services have an assigned doctor, show error
    if (doctorMap.size === 0) {
      error(
        t(
          'patientTreatmentPlan.noDoctorsAssignedToPlan',
          'None of the services in this plan have an assigned doctor. Please assign a doctor to schedule appointments.'
        )
      );
      return;
    }

    setActiveBookingContext({
      groupId: group.id,
      groupName: group.name,
      scope: 'GROUP',
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const schedules: DoctorApptSchedule[] = [];

    doctorMap.forEach((services, docId) => {
      const doc = doctors.find((d) => d.id === docId);
      const docName = doc ? doc.name : t('common.unassignedDoctor', 'Doctor');
      const appointmentNotes = formatServicesForNotes(services);

      schedules.push({
        doctorId: docId,
        doctorName: docName,
        services,
        selected: true,
        date: todayStr,
        startTime: '',
        endTime: '',
        durationMinutes: 30,
        type: 'PROCEDURE',
        reason: '',
        notes: appointmentNotes,
        availableSlots: [],
        loadingSlots: false,
        status: 'idle',
        errorMessage: undefined,
        appointmentId: undefined,
      });
    });

    setMultiDoctorAppts(schedules);
    setActiveDocTabIdx(0);

    if (schedules.length === 1) {
      // Single doctor — use single-mode form
      setIsMultiDoctorModal(false);
      const s = schedules[0];
      setApptForm({
        doctorId: s.doctorId,
        date: s.date,
        startTime: '',
        endTime: '',
        durationMinutes: 30,
        type: 'PROCEDURE',
        reason: '',
        notes: s.notes,
      });
      setSingleSlots([]);
      loadSingleSlots(s.doctorId, s.date, 30);
    } else {
      setIsMultiDoctorModal(true);
      // Load slots for all doctors in parallel
      schedules.forEach((s, idx) => {
        loadMultiSlots(idx, s.doctorId, s.date, s.durationMinutes);
      });
    }

    setActiveApptMobileTab('form');
    setIsApptModalOpen(true);
  };

  // Open Appointment Modal for a single Item
  const handleOpenApptModalForItem = (item: ProposedItem, group: ProposedGroup) => {
    if ((group.status || 'CREATED') !== 'ACCEPTED') {
      return;
    }
    if (activeItemAppointmentMap.has(item.id)) {
      return;
    }

    // Validate all required fields on this individual service row
    if (!validateItemsForAppointment([item], 'ITEM', group.items)) {
      return;
    }

    const docId = item.doctorId || '';
    let itemToUse = item;
    if (!item.serviceId && item.treatmentName) {
      const matched = clinicServices.find(
        (cs) => cs.name?.toLowerCase().trim() === item.treatmentName?.toLowerCase().trim()
      );
      if (matched) {
        itemToUse = { ...item, serviceId: matched.id };
      }
    }

    setActiveBookingContext({
      groupId: group.id,
      groupName: group.name,
      scope: 'ITEM',
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const appointmentNotes = formatServicesForNotes([itemToUse]);
    const docName = doctors.find((d) => d.id === docId)?.name || t('common.unassignedDoctor', 'Doctor');

    setIsMultiDoctorModal(false);
    setMultiDoctorAppts([{
      doctorId: docId,
      doctorName: docName,
      services: [itemToUse],
      selected: true,
      date: todayStr,
      startTime: '',
      endTime: '',
      durationMinutes: 30,
      type: 'PROCEDURE',
      reason: '',
      notes: appointmentNotes,
      availableSlots: [],
      loadingSlots: false,
      status: 'idle',
    }]);
    setUnassignedCount(0);
    setApptForm({
      doctorId: docId,
      date: todayStr,
      startTime: '',
      endTime: '',
      durationMinutes: 30,
      type: 'PROCEDURE',
      reason: '',
      notes: appointmentNotes,
    });
    setSingleSlots([]);
    loadSingleSlots(docId, todayStr, 30);
    setActiveApptMobileTab('form');
    setIsApptModalOpen(true);
  };

  // Update a specific schedule draft in multi-doctor mode
  const handleUpdateDoctorApptSchedule = (
    index: number,
    field: keyof DoctorApptSchedule,
    value: any
  ) => {
    setMultiDoctorAppts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Submit Appointment(s) — with pre-booking plan sync & Promise.allSettled for resilience
  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;

    const ensurePlanSynced = async () => {
      await clinicOdontogramService.saveProposedTreatmentPlan(patientId, {
        groups: planGroups,
        grandTotal,
      });
    };

    if (isMultiDoctorModal) {
      const activeSchedules = multiDoctorAppts.filter(
        (s) => s.selected && s.status !== 'success'
      );
      if (!activeSchedules.length) {
        error(
          t(
            'patientTreatmentPlan.selectAtLeastOneAppt',
            'Please select at least one doctor appointment to schedule.'
          )
        );
        return;
      }

      for (const s of activeSchedules) {
        if (!s.doctorId) {
          error(t('patientTreatmentPlan.selectDoctor', 'Please ensure all scheduled appointments have an assigned doctor.'));
          return;
        }
        if (!s.date || !s.startTime) {
          error(
            t('patientTreatmentPlan.selectSlotForDoctor', 'Please select an available time slot for {{doctorName}}.', {
              doctorName: s.doctorName,
            })
          );
          const tabIdx = multiDoctorAppts.findIndex((x) => x.doctorId === s.doctorId);
          if (tabIdx >= 0) setActiveDocTabIdx(tabIdx);
          return;
        }
      }

      // Mark active ones as saving
      setMultiDoctorAppts((prev) =>
        prev.map((s) =>
          s.selected && s.status !== 'success'
            ? { ...s, status: 'saving' as const, errorMessage: undefined }
            : s
        )
      );
      setApptSubmitting(true);

      try {
        await ensurePlanSynced();
      } catch (syncErr: any) {
        setApptSubmitting(false);
        setMultiDoctorAppts((prev) =>
          prev.map((s) => (s.status === 'saving' ? { ...s, status: 'idle' as const } : s))
        );
        error(
          syncErr?.response?.data?.message ||
            t('patientTreatmentPlan.planSaveFailed', 'Failed to synchronize treatment plan before scheduling.')
        );
        return;
      }

      const results = await Promise.allSettled(
        activeSchedules.map((s) => {
          const serviceIds = (s.services || []).map((srv) => srv.serviceId).filter(Boolean);
          const treatmentPlanItemIds = (s.services || []).map((srv) => srv.id).filter(Boolean);
          const expectedAmount = (s.services || []).reduce(
            (sum, srv) => sum + Number(srv.unitPrice || 0) * (srv.quantity || 1),
            0
          );
          return api.post('/clinic/appointments', {
            patientId,
            doctorId: s.doctorId,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime || calculateEndTime(s.startTime, s.durationMinutes),
            durationMinutes: s.durationMinutes,
            type: s.type,
            reason: s.reason,
            notes: s.notes,
            serviceIds,
            expectedAmount: expectedAmount > 0 ? expectedAmount : undefined,
            patientOdontogramId: data?.odontogram?.id,
            treatmentPlanGroupId: activeBookingContext?.groupId,
            treatmentPlanGroupName: activeBookingContext?.groupName,
            treatmentPlanItemIds,
            treatmentPlanScope: activeBookingContext?.scope || 'GROUP',
          });
        })
      );

      let successCount = 0;
      let failCount = 0;

      setMultiDoctorAppts((prev) => {
        const copy = [...prev];
        activeSchedules.forEach((s, i) => {
          const idx = copy.findIndex((x) => x.doctorId === s.doctorId && x.status === 'saving');
          if (idx === -1) return;
          if (results[i].status === 'fulfilled') {
            copy[idx] = {
              ...copy[idx],
              status: 'success',
              appointmentId: (results[i] as any).value?.data?.id,
              errorMessage: undefined,
            };
            successCount++;
          } else {
            const reason = (results[i] as any).reason;
            copy[idx] = {
              ...copy[idx],
              status: 'error',
              errorMessage:
                reason?.response?.data?.message || reason?.message || 'Unknown error',
            };
            failCount++;
          }
        });
        return copy;
      });

      setApptSubmitting(false);

      if (successCount > 0) {
        await fetchPlanData({ silent: true });
      }

      if (failCount === 0) {
        success(t('clinicAppointments.createSuccess', 'Appointments scheduled successfully.'));
        setIsApptModalOpen(false);
      } else if (successCount > 0) {
        error(
          t(
            'patientTreatmentPlan.partialSuccess',
            'Some appointments were scheduled. Please resolve errors below and retry.'
          )
        );
        const firstErrIdx = multiDoctorAppts.findIndex(
          (s) => s.selected && s.status !== 'success'
        );
        if (firstErrIdx >= 0) setActiveDocTabIdx(firstErrIdx);
      } else {
        error(t('clinicAppointments.createFailed', 'Failed to schedule appointment.'));
      }
      return;
    }

    // Single appointment creation
    if (!apptForm.doctorId) {
      error(t('patientTreatmentPlan.selectDoctor', 'Please select a doctor.'));
      return;
    }
    if (!apptForm.date || !apptForm.startTime) {
      error(t('clinicAppointments.fillRequired', 'Please fill in all required date and time fields.'));
      return;
    }

    const singleServices = multiDoctorAppts[0]?.services || [];
    const serviceIds = singleServices.map((srv) => srv.serviceId).filter(Boolean);
    const treatmentPlanItemIds = singleServices.map((srv) => srv.id).filter(Boolean);
    const expectedAmount = singleServices.reduce(
      (sum, srv) => sum + Number(srv.unitPrice || 0) * (srv.quantity || 1),
      0
    );

    setApptSubmitting(true);
    try {
      await ensurePlanSynced();
      await api.post('/clinic/appointments', {
        patientId,
        doctorId: apptForm.doctorId,
        date: apptForm.date,
        startTime: apptForm.startTime,
        endTime: apptForm.endTime || calculateEndTime(apptForm.startTime, apptForm.durationMinutes),
        durationMinutes: apptForm.durationMinutes,
        type: apptForm.type,
        reason: apptForm.reason,
        notes: apptForm.notes,
        serviceIds,
        expectedAmount: expectedAmount > 0 ? expectedAmount : undefined,
        patientOdontogramId: data?.odontogram?.id,
        treatmentPlanGroupId: activeBookingContext?.groupId,
        treatmentPlanGroupName: activeBookingContext?.groupName,
        treatmentPlanItemIds,
        treatmentPlanScope: activeBookingContext?.scope || 'GROUP',
      });
      await fetchPlanData({ silent: true });
      success(t('clinicAppointments.createSuccess', 'Appointment scheduled successfully.'));
      setIsApptModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create appointment:', err);
      error(
        err.response?.data?.message ||
          t('clinicAppointments.createFailed', 'Failed to schedule appointment.')
      );
    } finally {
      setApptSubmitting(false);
    }
  };

  // Distinct Treatment Options for filtering
  interface TreatmentOption {
    id: string;
    name: string;
    color?: string;
    count: number;
  }

  const treatmentOptions = useMemo<TreatmentOption[]>(() => {
    if (!treatments.length) return [];
    const map = new Map<string, { name: string; color?: string; count: number }>();
    treatments.forEach((t) => {
      const name = t.treatmentName || t.treatment?.name || 'Treatment';
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(name, {
          name,
          color: t.color || t.treatment?.color,
          count: 1,
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return [
      {
        id: 'all',
        name: t('patientTreatmentPlan.allTreatments', 'All Treatments'),
        color: undefined,
        count: treatments.length,
      },
      ...list.map((it) => ({
        id: it.name,
        name: it.name,
        color: it.color,
        count: it.count,
      })),
    ];
  }, [treatments, t]);

  // Active treatments filtered by selected treatment plan
  const activeTreatments = useMemo(() => {
    if (selectedTreatment === 'all') return treatments;
    return treatments.filter(
      (tr) => (tr.treatmentName || tr.treatment?.name || 'Treatment') === selectedTreatment,
    );
  }, [treatments, selectedTreatment]);

  // 4 Quadrants Anatomical Grouping
  interface QuadrantSummary {
    key: ToothQuadrant;
    label: string;
    subLabel: string;
    arch: 'MAXILLA' | 'MANDIBLE';
    side: 'RIGHT' | 'LEFT';
    totalCount: number;
    anterior: PatientOdontogramTreatmentItem[];
    posterior: PatientOdontogramTreatmentItem[];
  }

  const quadrantsData = useMemo<QuadrantSummary[]>(() => {
    const qMap: Record<ToothQuadrant, { anterior: PatientOdontogramTreatmentItem[]; posterior: PatientOdontogramTreatmentItem[] }> = {
      Q1: { anterior: [], posterior: [] },
      Q2: { anterior: [], posterior: [] },
      Q3: { anterior: [], posterior: [] },
      Q4: { anterior: [], posterior: [] },
    };

    activeTreatments.forEach((tr) => {
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      if (zone === 'POSTERIOR') {
        qMap[quadrant].posterior.push(tr);
      } else {
        qMap[quadrant].anterior.push(tr);
      }
    });

    (['Q1', 'Q2', 'Q3', 'Q4'] as ToothQuadrant[]).forEach((qKey) => {
      qMap[qKey].anterior.sort((a, b) => a.toothNumber - b.toothNumber);
      qMap[qKey].posterior.sort((a, b) => a.toothNumber - b.toothNumber);
    });

    return [
      {
        key: 'Q1',
        label: t('patientTreatmentPlan.quadrant1', 'Quadrant 1'),
        subLabel: t('patientTreatmentPlan.quadrant1Sub', 'Upper Right (Maxilla)'),
        arch: 'MAXILLA',
        side: 'RIGHT',
        totalCount: qMap.Q1.anterior.length + qMap.Q1.posterior.length,
        anterior: qMap.Q1.anterior,
        posterior: qMap.Q1.posterior,
      },
      {
        key: 'Q2',
        label: t('patientTreatmentPlan.quadrant2', 'Quadrant 2'),
        subLabel: t('patientTreatmentPlan.quadrant2Sub', 'Upper Left (Maxilla)'),
        arch: 'MAXILLA',
        side: 'LEFT',
        totalCount: qMap.Q2.anterior.length + qMap.Q2.posterior.length,
        anterior: qMap.Q2.anterior,
        posterior: qMap.Q2.posterior,
      },
      {
        key: 'Q4',
        label: t('patientTreatmentPlan.quadrant4', 'Quadrant 4'),
        subLabel: t('patientTreatmentPlan.quadrant4Sub', 'Lower Right (Mandible)'),
        arch: 'MANDIBLE',
        side: 'RIGHT',
        totalCount: qMap.Q4.anterior.length + qMap.Q4.posterior.length,
        anterior: qMap.Q4.anterior,
        posterior: qMap.Q4.posterior,
      },
      {
        key: 'Q3',
        label: t('patientTreatmentPlan.quadrant3', 'Quadrant 3'),
        subLabel: t('patientTreatmentPlan.quadrant3Sub', 'Lower Left (Mandible)'),
        arch: 'MANDIBLE',
        side: 'LEFT',
        totalCount: qMap.Q3.anterior.length + qMap.Q3.posterior.length,
        anterior: qMap.Q3.anterior,
        posterior: qMap.Q3.posterior,
      },
    ];
  }, [activeTreatments, t]);


  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '32px',
          color: 'var(--text-muted, #64748b)',
        }}
      >
        <Loader2
          size={36}
          className="animate-spin"
          style={{ color: 'var(--primary-600, #0d9488)', marginBottom: '12px' }}
        />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {t('patientTreatmentPlan.loading', 'Loading patient treatment plan...')}
        </span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ maxWidth: '900px', margin: '32px auto', padding: '0 20px' }}>
        <button
          type="button"
          onClick={() => navigate('/clinic/patients')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
        >
          <ArrowLeft size={16} />
          <span>{t('patientTreatmentPlan.backToPatients', 'Back to Patients')}</span>
        </button>
        <div
          className="card"
          style={{
            padding: '24px',
            backgroundColor: 'var(--badge-danger-bg, #ffe4e6)',
            borderColor: 'var(--rose-500, #f43f5e)',
            color: 'var(--badge-danger-text, #be123c)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderRadius: '12px',
          }}
        >
          <AlertCircle size={22} />
          <span style={{ fontWeight: 600 }}>
            {t('patientTreatmentPlan.notFound', 'Patient data not found.')}
          </span>
        </div>
      </div>
    );
  }

  // Full-Page Print Preview Mode (No popup, clean dedicated page view)
  if (viewMode === 'print-preview') {
    return (
      <TreatmentPlanPrintView
        onBack={() => setViewMode('plan')}
        clinicName={user?.activeTenant?.name}
        patient={patient}
        treatments={treatments}
        planGroups={planGroups}
        doctors={doctors}
        clinicServices={clinicServices}
        grandTotal={grandTotal}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* ─── Top Header & Navigation Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Tooltip content={t('patientTreatmentPlan.backToPatients', 'Back to Patients')}>
            <button
              type="button"
              onClick={() => navigate('/clinic/patients')}
              className="btn btn-secondary"
              style={{
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                color: 'var(--text-heading, #0f172a)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
              }}
              aria-label={t('patientTreatmentPlan.backToPatients', 'Back to Patients')}
            >
              <ArrowLeft size={18} />
            </button>
          </Tooltip>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-heading, #0f172a)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('patientTreatmentPlan.pageTitle', 'Treatment Plan')}
            </h1>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted, #64748b)',
                marginTop: '2px',
              }}
            >
              {t('patientTreatmentPlan.summarySubtitle', 'Counts of clinical treatment per zone')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsAddNoteOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--primary-300, #5eead4)',
              backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
              color: 'var(--primary-700, #0f766e)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={16} style={{ color: 'var(--primary-600, #0d9488)' }} />
            <span>{t('patientTreatmentPlan.addNote', 'Add Note')}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/clinic/patients/${patient?.id}/odontogram`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--primary-300, #5eead4)',
              backgroundColor: 'var(--badge-primary-bg, #f0fdfa)',
              color: 'var(--primary-700, #0f766e)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ToothIcon size={16} />
            <span>{t('patientTreatmentPlan.viewOdontogram', 'View Odontogram')}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setViewMode('print-preview')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Printer size={16} />
            <span>{t('patientTreatmentPlan.printPlan', 'Print Plan')}</span>
          </button>
        </div>
      </div>

      {/* ─── Patient Header: Name, Contact & Essential Medical Alerts ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          padding: '16px 22px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
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
          {/* Patient Name & Record Number */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                color: 'var(--primary-600, #0d9488)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  {t('patientTreatmentPlan.name', 'Patient Name')}
                </span>
                {patient?.recordNumber && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      color: 'var(--primary-700, #0f766e)',
                    }}
                  >
                    #{patient.recordNumber}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: 'var(--text-heading, #0f172a)',
                  marginTop: '1px',
                }}
              >
                {patientFullName || t('common.unnamed', 'Unnamed Patient')}
              </div>
            </div>
          </div>

          {/* Contact Details (Phone & Email) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Phone size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.phone', 'Phone')}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient?.phoneNumber
                    ? `${patient.phoneCountryCode || '+52'} ${patient.phoneNumber}`
                    : '—'}
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.email', 'Email')}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient?.email || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Important Medical Information (Allergies & Medications) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Allergies Pill */}
            {patient?.allergies ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title={patient.allergies}
              >
                <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span>
                  <strong>{t('patientTreatmentPlan.allergies', 'Allergies')}:</strong>{' '}
                  {patient.allergies}
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>{t('patientTreatmentPlan.noKnownAllergies', 'No known allergies')}</span>
              </div>
            )}

            {/* Medications Pill */}
            {patient?.medications ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title={patient.medications}
              >
                <Pill size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span>
                  <strong>{t('patientTreatmentPlan.medications', 'Medications')}:</strong>{' '}
                  {patient.medications}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ─── Main Section: Treatments Summary (by Quadrant) ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        {/* Section Header with Expand / Collapse Toggle (Collapsed by default) */}
        <div
          onClick={() => setSummaryExpanded((prev) => !prev)}
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            cursor: 'pointer',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderBottom: summaryExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none',
            userSelect: 'none',
            transition: 'background-color 0.15s ease',
          }}
          role="button"
          tabIndex={0}
          aria-expanded={summaryExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSummaryExpanded((prev) => !prev);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-heading, #0f172a)',
                flexShrink: 0,
              }}
            >
              <LayoutGrid size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-heading, #0f172a)',
                    margin: 0,
                  }}
                >
                  {t('patientTreatmentPlan.summaryTitle', 'Treatments Summary (by Quadrant)')}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor:
                      treatments.length > 0
                        ? 'var(--badge-primary-bg, rgba(13, 148, 136, 0.12))'
                        : 'var(--bg-surface, #f1f5f9)',
                    color:
                      treatments.length > 0
                        ? 'var(--primary-700, #0f766e)'
                        : 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {treatments.length}{' '}
                  {treatments.length === 1
                    ? t('patientTreatmentPlan.procedure', 'procedure')
                    : t('patientTreatmentPlan.procedures', 'procedures')}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted, #94a3b8)',
                  marginTop: '1px',
                }}
              >
                {t('patientTreatmentPlan.summarySubtitle', 'Counts of clinical treatment per zone')}
              </div>
            </div>
          </div>

          {/* Expand/Collapse Button (Rule 10: Touch target >= 40px) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSummaryExpanded((prev) => !prev);
            }}
            className="btn btn-secondary"
            style={{
              minHeight: '40px',
              minWidth: '40px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-heading, #0f172a)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
            }}
            aria-label={
              summaryExpanded
                ? t('patientTreatmentPlan.collapseSummary', 'Collapse Summary')
                : t('patientTreatmentPlan.expandSummary', 'Expand Summary')
            }
          >
            <span>
              {summaryExpanded
                ? t('patientTreatmentPlan.hideSummary', 'Hide Summary')
                : t('patientTreatmentPlan.showSummary', 'Show Summary')}
            </span>
            {summaryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Collapsible Content */}
        {summaryExpanded && (
          <>
            {treatments.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <FileSpreadsheet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {t(
                    'patientTreatmentPlan.noTreatmentsFound',
                    'No treatments marked on the odontogram yet.'
                  )}
                </div>
              </div>
            ) : (
              <>
            {/* ─── Interactive Treatment Selector Bar ─── */}
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
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
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-heading, #0f172a)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {t('patientTreatmentPlan.filterByTreatment', 'Filter by Treatment Plan:')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  {activeTreatments.length}{' '}
                  {activeTreatments.length === 1
                    ? t('patientTreatmentPlan.procedure', 'procedure')
                    : t('patientTreatmentPlan.procedures', 'procedures')}
                </span>
              </div>

              {/* Treatment Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {treatmentOptions.map((opt) => {
                  const isSelected = selectedTreatment === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedTreatment(opt.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        backgroundColor: isSelected
                          ? 'var(--primary-600, #0d9488)'
                          : 'var(--bg-card, #ffffff)',
                        color: isSelected ? '#ffffff' : 'var(--text-heading, #0f172a)',
                        border: isSelected
                          ? '1px solid var(--primary-600, #0d9488)'
                          : '1px solid var(--border-color, #cbd5e1)',
                        boxShadow: isSelected
                          ? '0 2px 6px rgba(13, 148, 136, 0.25)'
                          : 'none',
                      }}
                    >
                      {opt.color && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#ffffff' : opt.color,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span>{opt.name}</span>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: isSelected
                            ? 'rgba(255, 255, 255, 0.25)'
                            : 'var(--bg-surface-muted, #f1f5f9)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                        }}
                      >
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Interactive 4-Quadrant Anatomical Dental Chart (Option 1) ─── */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* ─── 4-Quadrant Anatomical Cross ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Upper Arch Label & Midline orientation */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '0 4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--primary-700, #0f766e)',
                      }}
                    >
                      ▲ {t('patientTreatmentPlan.upperArch', 'Maxilla (Upper Arch)')}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted, #94a3b8)',
                        fontStyle: 'italic',
                      }}
                    >
                      {t('patientTreatmentPlan.patientRight', 'Patient Right')} ⟵ {t('patientTreatmentPlan.midline', 'Dental Midline')} ⟶ {t('patientTreatmentPlan.patientLeft', 'Patient Left')}
                    </span>
                  </div>

                  {/* Upper Row: Q1 (Upper Right) & Q2 (Upper Left) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {quadrantsData
                      .filter((q) => q.arch === 'MAXILLA')
                      .map((q) => {
                        const hasItems = q.totalCount > 0;
                        return (
                          <div
                            key={q.key}
                            style={{
                              backgroundColor: hasItems
                                ? 'var(--bg-card, #ffffff)'
                                : 'var(--bg-surface-muted, #f8fafc)',
                              borderRadius: '12px',
                              border: hasItems
                                ? '1px solid var(--border-color, #e2e8f0)'
                                : '1px dashed var(--border-color, #cbd5e1)',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: hasItems ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {/* Card Header */}
                            <div
                              style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: hasItems
                                  ? 'rgba(13, 148, 136, 0.04)'
                                  : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: hasItems
                                      ? 'var(--primary-600, #0d9488)'
                                      : 'var(--text-muted, #94a3b8)',
                                    color: '#ffffff',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {q.key}
                                </span>
                                <div>
                                  <div
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 700,
                                      color: 'var(--text-heading, #0f172a)',
                                    }}
                                  >
                                    {q.label}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--text-muted, #64748b)',
                                      marginTop: '1px',
                                    }}
                                  >
                                    {q.subLabel}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  padding: '3px 9px',
                                  borderRadius: '12px',
                                  backgroundColor: hasItems
                                    ? 'var(--badge-success-bg, #dcfce7)'
                                    : 'var(--bg-surface, #f1f5f9)',
                                  color: hasItems
                                    ? 'var(--badge-success-text, #15803d)'
                                    : 'var(--text-muted, #94a3b8)',
                                }}
                              >
                                {q.totalCount}{' '}
                                {q.totalCount === 1
                                  ? t('patientTreatmentPlan.procedure', 'procedure')
                                  : t('patientTreatmentPlan.procedures', 'procedures')}
                              </span>
                            </div>

                            {/* Card Body */}
                            <div
                              style={{
                                padding: '14px 16px',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}
                            >
                              {!hasItems ? (
                                <div
                                  style={{
                                    padding: '26px 12px',
                                    textAlign: 'center',
                                    color: 'var(--text-muted, #94a3b8)',
                                    fontSize: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <ToothIcon size={22} color="var(--border-color, #cbd5e1)" />
                                  <span>
                                    {t(
                                      'patientTreatmentPlan.noProceduresInQuad',
                                      'No planned procedures in this quadrant'
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {/* Posterior Zone */}
                                  {q.posterior.length > 0 && (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          color: 'var(--text-muted, #64748b)',
                                          marginBottom: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <span>
                                          {t(
                                            'patientTreatmentPlan.posteriorZone',
                                            'Posterior (Premolars & Molars)'
                                          )}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                                          ({q.posterior.length})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {q.posterior.map((item) => {
                                          const statusKey =
                                            item.status === 'COMPLETED'
                                              ? 'statusCompleted'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'statusInProgress'
                                              : item.status === 'CANCELLED'
                                              ? 'statusCancelled'
                                              : 'statusPlanned';
                                          const statusBg =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-bg, #dcfce7)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-bg, #fef3c7)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-bg, #ffe4e6)'
                                              : 'var(--badge-info-bg, #e0f2fe)';
                                          const statusColor =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-text, #15803d)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-text, #b45309)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-text, #be123c)'
                                              : 'var(--badge-info-text, #0369a1)';

                                          return (
                                            <div
                                              key={item.id}
                                              style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flex: '1 1 auto',
                                                minWidth: '150px',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 800,
                                                  fontSize: '12px',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'var(--bg-card, #ffffff)',
                                                  border: '1px solid var(--border-color, #cbd5e1)',
                                                  color: 'var(--text-heading, #0f172a)',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                #{item.toothNumber}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: '12px',
                                                  color: 'var(--text-muted, #64748b)',
                                                  flexShrink: 0,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                              </span>
                                              <div
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  minWidth: 0,
                                                }}
                                              >
                                                {item.color && (
                                                  <span
                                                    style={{
                                                      width: '8px',
                                                      height: '8px',
                                                      borderRadius: '50%',
                                                      backgroundColor: item.color,
                                                      flexShrink: 0,
                                                    }}
                                                  />
                                                )}
                                                <span
                                                  style={{
                                                    fontSize: '12.5px',
                                                    fontWeight: 600,
                                                    color: 'var(--text-heading, #0f172a)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                  title={item.treatmentName}
                                                >
                                                  {item.treatmentName}
                                                </span>
                                              </div>

                                              {item.status && item.status !== 'PLANNED' && (
                                                <span
                                                  style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    marginLeft: 'auto',
                                                    flexShrink: 0,
                                                  }}
                                                >
                                                  {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Anterior Zone */}
                                  {q.anterior.length > 0 && (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          color: 'var(--text-muted, #64748b)',
                                          marginBottom: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <span>
                                          {t(
                                            'patientTreatmentPlan.anteriorZone',
                                            'Anterior (Incisors & Canines)'
                                          )}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                                          ({q.anterior.length})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {q.anterior.map((item) => {
                                          const statusKey =
                                            item.status === 'COMPLETED'
                                              ? 'statusCompleted'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'statusInProgress'
                                              : item.status === 'CANCELLED'
                                              ? 'statusCancelled'
                                              : 'statusPlanned';
                                          const statusBg =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-bg, #dcfce7)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-bg, #fef3c7)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-bg, #ffe4e6)'
                                              : 'var(--badge-info-bg, #e0f2fe)';
                                          const statusColor =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-text, #15803d)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-text, #b45309)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-text, #be123c)'
                                              : 'var(--badge-info-text, #0369a1)';

                                          return (
                                            <div
                                              key={item.id}
                                              style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flex: '1 1 auto',
                                                minWidth: '150px',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 800,
                                                  fontSize: '12px',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'var(--bg-card, #ffffff)',
                                                  border: '1px solid var(--border-color, #cbd5e1)',
                                                  color: 'var(--text-heading, #0f172a)',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                #{item.toothNumber}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: '12px',
                                                  color: 'var(--text-muted, #64748b)',
                                                  flexShrink: 0,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                              </span>
                                              <div
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  minWidth: 0,
                                                }}
                                              >
                                                {item.color && (
                                                  <span
                                                    style={{
                                                      width: '8px',
                                                      height: '8px',
                                                      borderRadius: '50%',
                                                      backgroundColor: item.color,
                                                      flexShrink: 0,
                                                    }}
                                                  />
                                                )}
                                                <span
                                                  style={{
                                                    fontSize: '12.5px',
                                                    fontWeight: 600,
                                                    color: 'var(--text-heading, #0f172a)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                  title={item.treatmentName}
                                                >
                                                  {item.treatmentName}
                                                </span>
                                              </div>

                                              {item.status && item.status !== 'PLANNED' && (
                                                <span
                                                  style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    marginLeft: 'auto',
                                                    flexShrink: 0,
                                                  }}
                                                >
                                                  {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Anatomical Arch Separation Line / Dental Midline */}
                  <div
                    style={{
                      position: 'relative',
                      margin: '6px 0',
                      borderTop: '2px dashed var(--border-color, #cbd5e1)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        padding: '3px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: 'var(--text-muted, #64748b)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t('patientTreatmentPlan.midline', 'Dental Midline & Occlusal Plane')}
                    </span>
                  </div>

                  {/* Lower Arch Label */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--primary-700, #0f766e)',
                      }}
                    >
                      ▼ {t('patientTreatmentPlan.lowerArch', 'Mandible (Lower Arch)')}
                    </span>
                  </div>

                  {/* Lower Row: Q4 (Lower Right) & Q3 (Lower Left) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {quadrantsData
                      .filter((q) => q.arch === 'MANDIBLE')
                      .map((q) => {
                        const hasItems = q.totalCount > 0;
                        return (
                          <div
                            key={q.key}
                            style={{
                              backgroundColor: hasItems
                                ? 'var(--bg-card, #ffffff)'
                                : 'var(--bg-surface-muted, #f8fafc)',
                              borderRadius: '12px',
                              border: hasItems
                                ? '1px solid var(--border-color, #e2e8f0)'
                                : '1px dashed var(--border-color, #cbd5e1)',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: hasItems ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {/* Card Header */}
                            <div
                              style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: hasItems
                                  ? 'rgba(13, 148, 136, 0.04)'
                                  : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: hasItems
                                      ? 'var(--primary-600, #0d9488)'
                                      : 'var(--text-muted, #94a3b8)',
                                    color: '#ffffff',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {q.key}
                                </span>
                                <div>
                                  <div
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 700,
                                      color: 'var(--text-heading, #0f172a)',
                                    }}
                                  >
                                    {q.label}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--text-muted, #64748b)',
                                      marginTop: '1px',
                                    }}
                                  >
                                    {q.subLabel}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  padding: '3px 9px',
                                  borderRadius: '12px',
                                  backgroundColor: hasItems
                                    ? 'var(--badge-success-bg, #dcfce7)'
                                    : 'var(--bg-surface, #f1f5f9)',
                                  color: hasItems
                                    ? 'var(--badge-success-text, #15803d)'
                                    : 'var(--text-muted, #94a3b8)',
                                }}
                              >
                                {q.totalCount}{' '}
                                {q.totalCount === 1
                                  ? t('patientTreatmentPlan.procedure', 'procedure')
                                  : t('patientTreatmentPlan.procedures', 'procedures')}
                              </span>
                            </div>

                            {/* Card Body */}
                            <div
                              style={{
                                padding: '14px 16px',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                              }}
                            >
                              {!hasItems ? (
                                <div
                                  style={{
                                    padding: '26px 12px',
                                    textAlign: 'center',
                                    color: 'var(--text-muted, #94a3b8)',
                                    fontSize: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <ToothIcon size={22} color="var(--border-color, #cbd5e1)" />
                                  <span>
                                    {t(
                                      'patientTreatmentPlan.noProceduresInQuad',
                                      'No planned procedures in this quadrant'
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {/* Posterior Zone */}
                                  {q.posterior.length > 0 && (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          color: 'var(--text-muted, #64748b)',
                                          marginBottom: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <span>
                                          {t(
                                            'patientTreatmentPlan.posteriorZone',
                                            'Posterior (Premolars & Molars)'
                                          )}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                                          ({q.posterior.length})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {q.posterior.map((item) => {
                                          const statusKey =
                                            item.status === 'COMPLETED'
                                              ? 'statusCompleted'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'statusInProgress'
                                              : item.status === 'CANCELLED'
                                              ? 'statusCancelled'
                                              : 'statusPlanned';
                                          const statusBg =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-bg, #dcfce7)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-bg, #fef3c7)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-bg, #ffe4e6)'
                                              : 'var(--badge-info-bg, #e0f2fe)';
                                          const statusColor =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-text, #15803d)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-text, #b45309)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-text, #be123c)'
                                              : 'var(--badge-info-text, #0369a1)';

                                          return (
                                            <div
                                              key={item.id}
                                              style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flex: '1 1 auto',
                                                minWidth: '150px',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 800,
                                                  fontSize: '12px',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'var(--bg-card, #ffffff)',
                                                  border: '1px solid var(--border-color, #cbd5e1)',
                                                  color: 'var(--text-heading, #0f172a)',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                #{item.toothNumber}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: '12px',
                                                  color: 'var(--text-muted, #64748b)',
                                                  flexShrink: 0,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                              </span>
                                              <div
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  minWidth: 0,
                                                }}
                                              >
                                                {item.color && (
                                                  <span
                                                    style={{
                                                      width: '8px',
                                                      height: '8px',
                                                      borderRadius: '50%',
                                                      backgroundColor: item.color,
                                                      flexShrink: 0,
                                                    }}
                                                  />
                                                )}
                                                <span
                                                  style={{
                                                    fontSize: '12.5px',
                                                    fontWeight: 600,
                                                    color: 'var(--text-heading, #0f172a)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                  title={item.treatmentName}
                                                >
                                                  {item.treatmentName}
                                                </span>
                                              </div>

                                              {item.status && item.status !== 'PLANNED' && (
                                                <span
                                                  style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    marginLeft: 'auto',
                                                    flexShrink: 0,
                                                  }}
                                                >
                                                  {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Anterior Zone */}
                                  {q.anterior.length > 0 && (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          color: 'var(--text-muted, #64748b)',
                                          marginBottom: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <span>
                                          {t(
                                            'patientTreatmentPlan.anteriorZone',
                                            'Anterior (Incisors & Canines)'
                                          )}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                                          ({q.anterior.length})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {q.anterior.map((item) => {
                                          const statusKey =
                                            item.status === 'COMPLETED'
                                              ? 'statusCompleted'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'statusInProgress'
                                              : item.status === 'CANCELLED'
                                              ? 'statusCancelled'
                                              : 'statusPlanned';
                                          const statusBg =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-bg, #dcfce7)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-bg, #fef3c7)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-bg, #ffe4e6)'
                                              : 'var(--badge-info-bg, #e0f2fe)';
                                          const statusColor =
                                            item.status === 'COMPLETED'
                                              ? 'var(--badge-success-text, #15803d)'
                                              : item.status === 'IN_PROGRESS'
                                              ? 'var(--badge-warning-text, #b45309)'
                                              : item.status === 'CANCELLED'
                                              ? 'var(--badge-danger-text, #be123c)'
                                              : 'var(--badge-info-text, #0369a1)';

                                          return (
                                            <div
                                              key={item.id}
                                              style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flex: '1 1 auto',
                                                minWidth: '150px',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 800,
                                                  fontSize: '12px',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'var(--bg-card, #ffffff)',
                                                  border: '1px solid var(--border-color, #cbd5e1)',
                                                  color: 'var(--text-heading, #0f172a)',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                #{item.toothNumber}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: '12px',
                                                  color: 'var(--text-muted, #64748b)',
                                                  flexShrink: 0,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                              </span>
                                              <div
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  minWidth: 0,
                                                }}
                                              >
                                                {item.color && (
                                                  <span
                                                    style={{
                                                      width: '8px',
                                                      height: '8px',
                                                      borderRadius: '50%',
                                                      backgroundColor: item.color,
                                                      flexShrink: 0,
                                                    }}
                                                  />
                                                )}
                                                <span
                                                  style={{
                                                    fontSize: '12.5px',
                                                    fontWeight: 600,
                                                    color: 'var(--text-heading, #0f172a)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                  title={item.treatmentName}
                                                >
                                                  {item.treatmentName}
                                                </span>
                                              </div>

                                              {item.status && item.status !== 'PLANNED' && (
                                                <span
                                                  style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    backgroundColor: statusBg,
                                                    color: statusColor,
                                                    marginLeft: 'auto',
                                                    flexShrink: 0,
                                                  }}
                                                >
                                                  {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>

    {/* ─── Proposed Treatment Plan Section (Requirement 1 - 5) ─── */}
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '14px',
        border: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* ─── Section Header ─── */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-card, #ffffff)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-heading, #0f172a)',
              flexShrink: 0,
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--text-heading, #0f172a)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {t('patientTreatmentPlan.proposedPlanTitle', 'Treatment Plans')}
            </h2>
            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--text-muted, #64748b)',
                marginTop: '1px',
              }}
            >
              {t(
                'patientTreatmentPlan.proposedPlanSubtitle',
                'Group treatments into plans to discuss them with the patient. Each plan organizes services and appointments.'
              )}
            </div>
          </div>
        </div>

        {/* Audit History & Add Treatment Plan Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAuditModalState({ isOpen: true, groupId: 'ALL' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-heading, #0f172a)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <History size={16} style={{ color: 'var(--primary-600, #0d9488)' }} />
            <span>{t('patientTreatmentPlan.auditHistory', 'Audit History')}</span>
          </button>

          <button
            type="button"
            onClick={handleAddPlanGroup}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              color: '#ffffff',
              backgroundColor: '#0d9488',
              border: 'none',
              boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)',
              minHeight: '40px',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>{t('patientTreatmentPlan.addTreatmentPlan', 'New Treatment Plan')}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ─── Groups List (Treatment Plans) ─── */}
        {planGroups.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px dashed var(--border-color, #cbd5e1)',
              borderRadius: '12px',
            }}
          >
            <FileSpreadsheet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>
              {t(
                'patientTreatmentPlan.noTreatmentsInPlan',
                'No planned treatments to organize yet. Mark treatments on the Odontogram or click "+ New Treatment Plan" below.'
              )}
            </div>
            <button
              type="button"
              onClick={handleAddPlanGroup}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#0d9488',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              <span>{t('patientTreatmentPlan.addTreatmentPlan', 'New Treatment Plan')}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {planGroups.map((group) => {
              const groupSubtotal = group.items.reduce(
                (sum, it) => sum + (it.subtotal || 0),
                0
              );
              const isDragOver = dragOverGroupId === group.id;
              const groupAppts = activeGroupAppointmentsMap.get(group.id) || [];
              const hasActiveAppt = groupAppts.length > 0;
              const unscheduledItems = group.items.filter(
                (it) => !activeItemAppointmentMap.has(it.id)
              );
              const selectedCount = group.items.filter(
                (it) => it.isSelected && !activeItemAppointmentMap.has(it.id)
              ).length;
              const currentStatus = group.status || 'CREATED';
              const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.CREATED;
              const statusLabel = t(
                `patientTreatmentPlan.${statusCfg.labelKey}`,
                statusCfg.defaultLabel
              );
              const isAccepted = currentStatus === 'ACCEPTED';
              const isStatusSaving = Boolean(statusSavingGroupIds[group.id]);
              const createApptDisabledReason = t(
                'patientTreatmentPlan.createAppointmentDisabledStatus',
                'Treatment plan must be Accepted before creating an appointment (current status: {{status}}).',
                { status: statusLabel }
              );
              const movableTargetGroups = planGroups.filter(
                (g) =>
                  g.id !== group.id &&
                  (activeGroupAppointmentsMap.get(g.id) || []).length === 0
              );
              const allUnbookedSelected =
                unscheduledItems.length > 0 &&
                unscheduledItems.every((it) => it.isSelected);

              return (
                <div
                  key={group.id}
                  onDragOver={(e) => {
                    if (hasActiveAppt) return;
                    if (
                      draggedItems &&
                      (activeGroupAppointmentsMap.get(draggedItems.sourceGroupId) || [])
                        .length > 0
                    ) {
                      return;
                    }
                    if (
                      draggedRow &&
                      (activeGroupAppointmentsMap.get(draggedRow.groupId) || [])
                        .length > 0
                    ) {
                      return;
                    }
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverGroupId === group.id) setDragOverGroupId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverGroupId(null);
                    if (hasActiveAppt) return;
                    if (draggedItems) {
                      handleMoveItems(
                        draggedItems.itemIds,
                        draggedItems.sourceGroupId,
                        group.id
                      );
                      setDraggedItems(null);
                    }
                  }}
                  style={{
                    borderRadius: '12px',
                    border: isDragOver
                      ? '2px dashed var(--primary-600, #0d9488)'
                      : '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: isDragOver
                      ? 'rgba(13, 148, 136, 0.05)'
                      : 'var(--bg-card, #ffffff)',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
                  }}
                >
                  {/* Group Header Bar (Plan Name, Status, Count, Actions) */}
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-surface-muted, #f0f7ff)',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)',
                      borderTopLeftRadius: '11px',
                      borderTopRightRadius: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Service Count + Plan Title + Status SearchableSelect + Lock Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        flex: '1 1 auto',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor:
                            group.items.length > 0
                              ? 'var(--primary-600, #0d9488)'
                              : 'var(--bg-card, #ffffff)',
                          border:
                            group.items.length > 0
                              ? '1px solid var(--primary-600, #0d9488)'
                              : '1px solid var(--border-color, #cbd5e1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color:
                            group.items.length > 0
                              ? '#ffffff'
                              : 'var(--text-muted, #64748b)',
                          fontSize: '13px',
                          fontWeight: 700,
                          flexShrink: 0,
                          boxShadow:
                            group.items.length > 0
                              ? '0 1px 3px rgba(13, 148, 136, 0.3)'
                              : '0 1px 2px rgba(0, 0, 0, 0.04)',
                          transition: 'all 0.15s ease',
                        }}
                        title={t(
                          'patientTreatmentPlan.serviceCountTooltip',
                          '{{count}} services in this plan',
                          { count: group.items.length }
                        )}
                      >
                        {group.items.length}
                      </div>

                      {/* Editable Group Title Input (locked once appointment is active) */}
                      <input
                        type="text"
                        value={group.name}
                        disabled={hasActiveAppt}
                        onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                        placeholder="Plan 1"
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          padding: '6px 12px',
                          minHeight: '40px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          outline: 'none',
                          backgroundColor: hasActiveAppt
                            ? 'var(--bg-surface-muted, #f1f5f9)'
                            : 'var(--bg-card, #ffffff)',
                          color: 'var(--text-heading, #0f172a)',
                          boxShadow: 'none',
                          width: isMobileScreen ? '145px' : '180px',
                          cursor: hasActiveAppt ? 'not-allowed' : 'text',
                          opacity: hasActiveAppt ? 0.78 : 1,
                        }}
                        onFocus={(e) => {
                          if (!hasActiveAppt) e.target.style.borderColor = '#0d9488';
                        }}
                        onBlur={(e) =>
                          (e.target.style.borderColor = 'var(--border-color, #cbd5e1)')
                        }
                      />

                      {/* Treatment Plan Status Dropdown Selector */}
                      <div style={{ minWidth: '150px', width: isMobileScreen ? '100%' : '160px' }}>
                        <SearchableSelect
                          options={statusSelectOptions}
                          value={currentStatus}
                          disabled={isStatusSaving}
                          onChange={(newSt) =>
                            handlePlanStatusChange(group.id, newSt as TreatmentPlanStatus)
                          }
                          placeholder={t('patientTreatmentPlan.planStatus', 'Plan Status')}
                        />
                      </div>

                      {hasActiveAppt && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            color: '#4338ca',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                          }}
                        >
                          <Lock size={11} />
                          <span>
                            {groupAppts.length}{' '}
                            {t('patientTreatmentPlan.linkedAppointments', 'Linked Appointments')}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Right: Move To + Add Service + Create/Edit Appointment + Delete Plan */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {selectedCount > 0 && movableTargetGroups.length > 0 && !hasActiveAppt && (
                        <div style={{ width: '150px' }}>
                          <SearchableSelect
                            options={movableTargetGroups.map((targetG) => ({
                              value: targetG.id,
                              label: targetG.name,
                            }))}
                            value=""
                            onChange={(targetGId) => {
                              if (targetGId) {
                                const selectedIds = group.items
                                  .filter(
                                    (it) =>
                                      it.isSelected &&
                                      !activeItemAppointmentMap.has(it.id)
                                  )
                                  .map((it) => it.id);
                                handleMoveItems(selectedIds, group.id, targetGId);
                              }
                            }}
                            placeholder={t('patientTreatmentPlan.moveToVisit', 'Move to...')}
                            searchPlaceholder={t(
                              'patientTreatmentPlan.searchVisit',
                              'Search plan...'
                            )}
                          />
                        </div>
                      )}

                      {/* Add Service Button (Disabled after appointment is created) */}
                      <Tooltip
                        content={t(
                          'patientTreatmentPlan.addServiceDisabledLocked',
                          'Cannot add services after an appointment has been created for this plan.'
                        )}
                        disabled={!hasActiveAppt}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <button
                            type="button"
                            disabled={hasActiveAppt}
                            onClick={() => handleAddServiceToGroup(group.id)}
                            className="btn btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '7px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: hasActiveAppt
                                ? 'var(--text-muted, #94a3b8)'
                                : 'var(--primary-700, #0f766e)',
                              backgroundColor: hasActiveAppt
                                ? 'var(--bg-surface-muted, #f1f5f9)'
                                : 'var(--bg-card, #ffffff)',
                              border: hasActiveAppt
                                ? '1px solid var(--border-color, #cbd5e1)'
                                : '1px solid var(--primary-500, #0d9488)',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                              cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                              opacity: hasActiveAppt ? 0.55 : 1,
                              pointerEvents: hasActiveAppt ? 'none' : 'auto',
                              minHeight: '40px',
                            }}
                          >
                            <Plus size={14} />
                            <span>{t('patientTreatmentPlan.addService', 'Add Service')}</span>
                          </button>
                        </span>
                      </Tooltip>

                      {/* Create Appointment OR Edit Appointment Dropdown */}
                      {hasActiveAppt ? (
                        <EditAppointmentDropdown
                          appointments={groupAppts}
                          isOpen={openEditDropdownGroupId === group.id}
                          onToggle={() =>
                            setOpenEditDropdownGroupId((prev) =>
                              prev === group.id ? null : group.id
                            )
                          }
                          onClose={() => setOpenEditDropdownGroupId(null)}
                          onSelectAppointment={(aptId) =>
                            navigate(
                              `/clinic/appointments/${aptId}/edit?returnTo=treatment-plan&patientId=${patientId}`
                            )
                          }
                          unscheduledCount={unscheduledItems.length}
                          canScheduleRemaining={isAccepted}
                          onScheduleRemaining={() => handleOpenApptModalForGroup(group)}
                        />
                      ) : (
                        <Tooltip content={createApptDisabledReason} disabled={isAccepted}>
                          <span
                            style={{
                              display: 'inline-block',
                              cursor: !isAccepted ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <button
                              type="button"
                              disabled={!isAccepted}
                              onClick={() => handleOpenApptModalForGroup(group)}
                              className="btn btn-secondary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: !isAccepted
                                  ? 'var(--text-muted, #94a3b8)'
                                  : 'var(--indigo-700, #4338ca)',
                                backgroundColor: !isAccepted
                                  ? 'var(--bg-surface-muted, #f1f5f9)'
                                  : 'var(--bg-card, #ffffff)',
                                border: !isAccepted
                                  ? '1px solid var(--border-color, #cbd5e1)'
                                  : '1px solid var(--indigo-400, #818cf8)',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                                cursor: !isAccepted ? 'not-allowed' : 'pointer',
                                opacity: !isAccepted ? 0.55 : 1,
                                pointerEvents: !isAccepted ? 'none' : 'auto',
                                minHeight: '40px',
                              }}
                              aria-label={t(
                                'patientTreatmentPlan.createAppointment',
                                'Create appointment'
                              )}
                            >
                              <Calendar size={14} />
                              <span>
                                {t(
                                  'patientTreatmentPlan.createAppointment',
                                  'Create appointment'
                                )}
                              </span>
                            </button>
                          </span>
                        </Tooltip>
                      )}

                      {/* Delete Plan Button (Disabled after appointment is created) */}
                      <Tooltip
                        content={
                          hasActiveAppt
                            ? t(
                                'patientTreatmentPlan.deletePlanDisabledLocked',
                                'Cannot delete a treatment plan that has active appointments.'
                              )
                            : t('patientTreatmentPlan.deletePlan', 'Delete Plan')
                        }
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <button
                            type="button"
                            disabled={hasActiveAppt}
                            onClick={() => handleDeleteGroup(group.id)}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: hasActiveAppt
                                ? '1px solid var(--border-color, #cbd5e1)'
                                : '1px solid #fecaca',
                              backgroundColor: hasActiveAppt
                                ? 'var(--bg-surface-muted, #f1f5f9)'
                                : '#fee2e2',
                              color: hasActiveAppt
                                ? 'var(--text-muted, #94a3b8)'
                                : '#b91c1c',
                              cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                              opacity: hasActiveAppt ? 0.55 : 1,
                              pointerEvents: hasActiveAppt ? 'none' : 'auto',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                            }}
                            aria-label={t('patientTreatmentPlan.deletePlan', 'Delete Plan')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </Tooltip>
                    </div>
                  </div>

                  {/* ─── Group Treatment Items Table / Mobile Stacked Cards ─── */}
                  {group.items.length === 0 ? (
                    <div
                      style={{
                        padding: '32px 20px',
                        textAlign: 'center',
                        color: 'var(--text-muted, #94a3b8)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        borderBottomLeftRadius: '11px',
                        borderBottomRightRadius: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                      }}
                    >
                      <Layers size={26} style={{ opacity: 0.35 }} />
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>
                        {t(
                          'patientTreatmentPlan.dropHere',
                          'Drop treatments here or click "+ Add Service" to add procedures'
                        )}
                      </div>
                      <Tooltip
                        content={t(
                          'patientTreatmentPlan.addServiceDisabledLocked',
                          'Cannot add services after an appointment has been created for this plan.'
                        )}
                        disabled={!hasActiveAppt}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <button
                            type="button"
                            disabled={hasActiveAppt}
                            onClick={() => handleAddServiceToGroup(group.id)}
                            className="btn btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              minHeight: '40px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: hasActiveAppt
                                ? 'var(--text-muted, #94a3b8)'
                                : '#0f766e',
                              border: hasActiveAppt
                                ? '1px solid var(--border-color, #cbd5e1)'
                                : '1px solid #0d9488',
                              backgroundColor: hasActiveAppt
                                ? 'var(--bg-surface-muted, #f1f5f9)'
                                : 'rgba(13, 148, 136, 0.08)',
                              cursor: hasActiveAppt ? 'not-allowed' : 'pointer',
                              opacity: hasActiveAppt ? 0.55 : 1,
                              pointerEvents: hasActiveAppt ? 'none' : 'auto',
                            }}
                          >
                            <Plus size={14} />
                            <span>{t('patientTreatmentPlan.addService', 'Add Service')}</span>
                          </button>
                        </span>
                      </Tooltip>
                    </div>
                  ) : isMobileScreen ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px',
                      }}
                    >
                      {group.items.map((item, itemIdx) => {
                        const selectedDoctor = doctors.find((d) => d.id === item.doctorId);
                        const doctorServices = selectedDoctor?.services || [];
                        const treatmentOpts = getTreatmentOptionsForItem(
                          item.id,
                          item.treatmentName
                        );
                        const cleanTreatmentName = item.treatmentName
                          .replace(/\s*\([#\d\s,]+\)/g, '')
                          .replace(/#\d+/g, '')
                          .trim();
                        const cleanToothStr = (
                          item.otTeethNumber ||
                          (item.toothNumbers?.[0] ? String(item.toothNumbers[0]) : '')
                        )
                          .replace(/#/g, '')
                          .trim();
                        const currentTreatmentVal = cleanToothStr
                          ? `${cleanTreatmentName}__${cleanToothStr}`
                          : cleanTreatmentName;

                        const itemAppt = activeItemAppointmentMap.get(item.id);
                        const isItemBooked = Boolean(itemAppt);
                        const isSingleServiceAppt = itemAppt?.treatmentPlanScope === 'ITEM';
                        const isInvalidRow = invalidItemIds.has(item.id);
                        const isTreatmentInvalid =
                          isInvalidRow && !(item.treatmentName && item.treatmentName.trim());
                        const isDoctorInvalid = isInvalidRow && !item.doctorId;
                        const isServiceInvalid = isInvalidRow && !item.serviceId;
                        const isQtyInvalid =
                          isInvalidRow && !(item.quantity && Number(item.quantity) >= 1);
                        const isPriceInvalid =
                          isInvalidRow &&
                          !(
                            item.unitPrice !== undefined &&
                            item.unitPrice !== null &&
                            Number(item.unitPrice) > 0
                          );

                        return (
                          <div
                            key={item.id}
                            style={{
                              borderRadius: '10px',
                              border: isInvalidRow
                                ? '1.5px solid #ef4444'
                                : '1px solid var(--border-color, #e2e8f0)',
                              backgroundColor: isInvalidRow
                                ? 'rgba(239, 68, 68, 0.03)'
                                : isItemBooked
                                ? 'var(--bg-surface-muted, #f8fafc)'
                                : 'var(--bg-card, #ffffff)',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            {/* Mobile Card Header */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  disabled={isItemBooked}
                                  checked={Boolean(item.isSelected)}
                                  onChange={() => handleItemSelectionToggle(group.id, item.id)}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                    accentColor: 'var(--primary-600, #0d9488)',
                                    opacity: isItemBooked ? 0.45 : 1,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: 'var(--text-heading)',
                                  }}
                                >
                                  #{itemIdx + 1}
                                </span>
                                {cleanToothStr && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      fontFamily: 'monospace',
                                      color: '#0f766e',
                                      backgroundColor: 'rgba(13, 148, 136, 0.08)',
                                      border: '1px solid rgba(13, 148, 136, 0.25)',
                                      padding: '2px 6px',
                                      borderRadius: '6px',
                                    }}
                                  >
                                    OT {cleanToothStr}
                                  </span>
                                )}
                                {isItemBooked && itemAppt && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      color: '#4338ca',
                                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                      padding: '2px 7px',
                                      borderRadius: '999px',
                                    }}
                                  >
                                    <Lock size={10} />
                                    #{itemAppt.appointmentNumber}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isSingleServiceAppt && itemAppt ? (
                                  <Tooltip
                                    content={t(
                                      'patientTreatmentPlan.editServiceAppointment',
                                      'Edit Appointment ({{aptNumber}})',
                                      { aptNumber: itemAppt.appointmentNumber }
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/clinic/appointments/${itemAppt.id}/edit?returnTo=treatment-plan&patientId=${patientId}`
                                        )
                                      }
                                      style={{
                                        minWidth: '40px',
                                        height: '40px',
                                        padding: '0 10px',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px',
                                        border: '1px solid rgba(99, 102, 241, 0.45)',
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: '#4338ca',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                      aria-label={t(
                                        'patientTreatmentPlan.editAppointment',
                                        'Edit Appointment'
                                      )}
                                    >
                                      <CalendarCheck size={15} />
                                    </button>
                                  </Tooltip>
                                ) : isItemBooked ? (
                                  <Tooltip
                                    content={t(
                                      'patientTreatmentPlan.calendarDisabledGroupBooked',
                                      'Appointment already created at the treatment plan level. Use Edit Appointment above.'
                                    )}
                                  >
                                    <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>
                                      <button
                                        type="button"
                                        disabled
                                        style={{
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '8px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          border: '1px solid var(--border-color, #cbd5e1)',
                                          backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                                          color: 'var(--text-muted, #94a3b8)',
                                          opacity: 0.5,
                                          pointerEvents: 'none',
                                        }}
                                        aria-label={t(
                                          'patientTreatmentPlan.calendarDisabledGroupBooked',
                                          'Appointment already created at the treatment plan level.'
                                        )}
                                      >
                                        <Calendar size={15} />
                                      </button>
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <Tooltip
                                    content={
                                      !isAccepted
                                        ? createApptDisabledReason
                                        : t(
                                            'patientTreatmentPlan.createAppointment',
                                            'Create appointment'
                                          )
                                    }
                                  >
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        cursor: !isAccepted ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        disabled={!isAccepted}
                                        onClick={() => handleOpenApptModalForItem(item, group)}
                                        style={{
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '8px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          border: !isAccepted
                                            ? '1px solid var(--border-color, #cbd5e1)'
                                            : '1px solid var(--primary-500, #0d9488)',
                                          backgroundColor: !isAccepted
                                            ? 'var(--bg-surface-muted, #f1f5f9)'
                                            : 'rgba(13, 148, 136, 0.08)',
                                          color: !isAccepted
                                            ? 'var(--text-muted, #94a3b8)'
                                            : 'var(--primary-700, #0f766e)',
                                          cursor: !isAccepted ? 'not-allowed' : 'pointer',
                                          opacity: !isAccepted ? 0.5 : 1,
                                          pointerEvents: !isAccepted ? 'none' : 'auto',
                                        }}
                                        aria-label={t(
                                          'patientTreatmentPlan.createAppointment',
                                          'Create appointment'
                                        )}
                                      >
                                        <Calendar size={15} />
                                      </button>
                                    </span>
                                  </Tooltip>
                                )}

                                <Tooltip
                                  content={
                                    isItemBooked
                                      ? t(
                                          'patientTreatmentPlan.deleteServiceDisabledLocked',
                                          'Cannot delete this service because an appointment has already been created for it.'
                                        )
                                      : t('patientTreatmentPlan.deleteService', 'Delete Service')
                                  }
                                >
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      disabled={isItemBooked}
                                      onClick={() =>
                                        handleRemoveServiceFromGroup(group.id, item.id)
                                      }
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: isItemBooked
                                          ? '1px solid var(--border-color, #cbd5e1)'
                                          : '1px solid #fecaca',
                                        backgroundColor: isItemBooked
                                          ? 'var(--bg-surface-muted, #f1f5f9)'
                                          : 'rgba(239, 68, 68, 0.08)',
                                        color: isItemBooked
                                          ? 'var(--text-muted, #94a3b8)'
                                          : '#ef4444',
                                        cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                        opacity: isItemBooked ? 0.5 : 1,
                                        pointerEvents: isItemBooked ? 'none' : 'auto',
                                      }}
                                      aria-label={t(
                                        'patientTreatmentPlan.deleteService',
                                        'Delete Service'
                                      )}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </span>
                                </Tooltip>
                              </div>
                            </div>

                            {/* Mobile Fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {t('patientTreatmentPlan.treatmentColumn', 'Treatment')}
                                </div>
                                <SearchableSelect
                                  disabled={isItemBooked}
                                  options={treatmentOpts}
                                  value={
                                    treatmentOpts.some((o) => o.value === currentTreatmentVal)
                                      ? currentTreatmentVal
                                      : cleanTreatmentName
                                  }
                                  onChange={(val) =>
                                    handleItemTreatmentSelect(group.id, item.id, val)
                                  }
                                  placeholder={t(
                                    'patientTreatmentPlan.treatmentPlaceholder',
                                    'Select treatment...'
                                  )}
                                  triggerStyle={
                                    isTreatmentInvalid
                                      ? {
                                          borderColor: '#ef4444',
                                          boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          minHeight: '40px',
                                        }
                                      : { minHeight: '40px' }
                                  }
                                />
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {t('patientTreatmentPlan.doctorColumn', 'Doctor *')}
                                </div>
                                <SearchableSelect
                                  disabled={isItemBooked}
                                  options={doctorOptions}
                                  value={item.doctorId}
                                  onChange={(val) =>
                                    handleItemDoctorChange(group.id, item.id, val)
                                  }
                                  placeholder={t(
                                    'patientTreatmentPlan.selectDoctor',
                                    'Select Doctor...'
                                  )}
                                  triggerStyle={
                                    isDoctorInvalid
                                      ? {
                                          borderColor: '#ef4444',
                                          boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          minHeight: '40px',
                                        }
                                      : { minHeight: '40px' }
                                  }
                                />
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {t('patientTreatmentPlan.serviceColumn', 'Service *')}
                                </div>
                                <SearchableSelect
                                  disabled={isItemBooked}
                                  options={
                                    !item.doctorId
                                      ? []
                                      : doctorServices.length > 0
                                      ? doctorServices.map((srv) => ({
                                          value: srv.serviceId,
                                          label: srv.serviceName || srv.serviceId,
                                          sublabel:
                                            srv.customPrice !== undefined
                                              ? `${srv.customPrice} MXN`
                                              : undefined,
                                        }))
                                      : clinicServices.map((srv) => ({
                                          value: srv.id,
                                          label: srv.name,
                                          sublabel: `${srv.price} MXN`,
                                        }))
                                  }
                                  value={item.serviceId}
                                  onChange={(val) =>
                                    handleItemServiceChange(group.id, item.id, val)
                                  }
                                  placeholder={
                                    !item.doctorId
                                      ? t(
                                          'patientTreatmentPlan.selectDoctorFirst',
                                          'Select doctor first...'
                                        )
                                      : doctorServices.length === 0 &&
                                        clinicServices.length === 0
                                      ? t(
                                          'patientTreatmentPlan.noServicesForDoctor',
                                          'No services available'
                                        )
                                      : t(
                                          'patientTreatmentPlan.selectService',
                                          'Select Service...'
                                        )
                                  }
                                  triggerStyle={
                                    isServiceInvalid
                                      ? {
                                          borderColor: '#ef4444',
                                          boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          minHeight: '40px',
                                        }
                                      : { minHeight: '40px' }
                                  }
                                />
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '80px 1fr 1fr',
                                  gap: '8px',
                                  alignItems: 'end',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: 'var(--text-muted)',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    {t('patientTreatmentPlan.qtyColumn', 'Qty')}
                                  </div>
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={isItemBooked}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemQtyChange(group.id, item.id, e.target.value)
                                    }
                                    style={{
                                      width: '100%',
                                      minHeight: '40px',
                                      padding: '6px',
                                      fontSize: '13px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      borderRadius: '8px',
                                      border: isQtyInvalid
                                        ? '1.5px solid #ef4444'
                                        : '1px solid var(--border-color, #cbd5e1)',
                                      backgroundColor: isItemBooked
                                        ? 'var(--bg-surface-muted, #f1f5f9)'
                                        : 'var(--bg-card, #ffffff)',
                                      color: 'var(--text-heading, #0f172a)',
                                    }}
                                  />
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: 'var(--text-muted)',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    {t('patientTreatmentPlan.unitPriceColumn', 'Price (MXN)')}
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    disabled={isItemBooked}
                                    value={item.unitPrice === 0 ? '' : item.unitPrice}
                                    onChange={(e) =>
                                      handleItemUnitPriceChange(
                                        group.id,
                                        item.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder="0.00"
                                    style={{
                                      width: '100%',
                                      minHeight: '40px',
                                      padding: '6px 8px',
                                      fontSize: '13px',
                                      textAlign: 'right',
                                      fontWeight: 600,
                                      borderRadius: '8px',
                                      border: isPriceInvalid
                                        ? '1.5px solid #ef4444'
                                        : '1px solid var(--border-color, #cbd5e1)',
                                      backgroundColor: isItemBooked
                                        ? 'var(--bg-surface-muted, #f1f5f9)'
                                        : 'var(--bg-card, #ffffff)',
                                      color: 'var(--text-heading, #0f172a)',
                                    }}
                                  />
                                </div>
                                <div
                                  style={{
                                    minHeight: '40px',
                                    padding: '6px 8px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    textAlign: 'right',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      color: 'var(--text-muted)',
                                      lineHeight: 1.1,
                                    }}
                                  >
                                    {t('patientTreatmentPlan.subtotalColumn', 'Subtotal')}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      color: 'var(--text-heading)',
                                    }}
                                  >
                                    {item.subtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        overflowX: 'auto',
                      }}
                    >
                      <table
                        className="table"
                        style={{
                          width: '100%',
                          minWidth: '820px',
                          tableLayout: 'fixed',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          fontSize: '12.5px',
                        }}
                      >
                        <colgroup>
                          <col style={{ width: '4%' }} />
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '5%' }} />
                          <col style={{ width: '19%' }} />
                          <col style={{ width: '19%' }} />
                          <col style={{ width: '5%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--table-th-bg, #f8fafc)',
                              borderBottom: '2px solid var(--border-color, #e2e8f0)',
                            }}
                          >
                            <th style={{ padding: '10px 4px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                disabled={hasActiveAppt || unscheduledItems.length === 0}
                                checked={allUnbookedSelected}
                                onChange={(e) =>
                                  handleGroupSelectAllToggle(group.id, e.target.checked)
                                }
                                title={t('patientTreatmentPlan.selectAll', 'Select all')}
                                style={{
                                  width: '15px',
                                  height: '15px',
                                  cursor:
                                    hasActiveAppt || unscheduledItems.length === 0
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity:
                                    hasActiveAppt || unscheduledItems.length === 0 ? 0.45 : 1,
                                  accentColor: 'var(--primary-600, #0d9488)',
                                }}
                              />
                            </th>
                            <th style={{ padding: '10px 6px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {t('patientTreatmentPlan.treatmentColumn', 'Treatment')}
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              OT
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {t('patientTreatmentPlan.doctorColumn', 'Doctor *')}
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {t('patientTreatmentPlan.serviceColumn', 'Service *')}
                            </th>
                            <th style={{ padding: '10px 2px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {t('patientTreatmentPlan.qtyColumn', 'Qty')}
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              <span>Price</span>{' '}
                              <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)', textTransform: 'none' }}>
                                (MXN)
                              </span>
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              <span>Subtotal</span>{' '}
                              <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)', textTransform: 'none' }}>
                                (MXN)
                              </span>
                            </th>
                            <th style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {t('patientTreatmentPlan.appointmentColumn', 'Actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item, itemIdx) => {
                            const isBeingDragged =
                              Boolean(draggedItems?.itemIds.includes(item.id)) ||
                              draggedRow?.itemId === item.id;
                            const isDragTarget =
                              dragOverTarget?.groupId === group.id &&
                              dragOverTarget?.index === itemIdx;
                            const selectedDoctor = doctors.find(
                              (d) => d.id === item.doctorId
                            );
                            const doctorServices = selectedDoctor?.services || [];
                            const treatmentOpts = getTreatmentOptionsForItem(
                              item.id,
                              item.treatmentName
                            );
                            const cleanTreatmentName = item.treatmentName
                              .replace(/\s*\([#\d\s,]+\)/g, '')
                              .replace(/#\d+/g, '')
                              .trim();
                            const cleanToothStr = (
                              item.otTeethNumber ||
                              (item.toothNumbers?.[0] ? String(item.toothNumbers[0]) : '')
                            )
                              .replace(/#/g, '')
                              .trim();
                            const currentTreatmentVal = cleanToothStr
                              ? `${cleanTreatmentName}__${cleanToothStr}`
                              : cleanTreatmentName;

                            const itemAppt = activeItemAppointmentMap.get(item.id);
                            const isItemBooked = Boolean(itemAppt);
                            const isSingleServiceAppt =
                              itemAppt?.treatmentPlanScope === 'ITEM';
                            const isInvalidRow = invalidItemIds.has(item.id);
                            const isTreatmentInvalid =
                              isInvalidRow &&
                              !(item.treatmentName && item.treatmentName.trim());
                            const isDoctorInvalid = isInvalidRow && !item.doctorId;
                            const isServiceInvalid = isInvalidRow && !item.serviceId;
                            const isQtyInvalid =
                              isInvalidRow && !(item.quantity && Number(item.quantity) >= 1);
                            const isPriceInvalid =
                              isInvalidRow &&
                              !(
                                item.unitPrice !== undefined &&
                                item.unitPrice !== null &&
                                Number(item.unitPrice) > 0
                              );

                            return (
                              <tr
                                key={item.id}
                                draggable={!isItemBooked}
                                onDragStart={(e) => {
                                  if (isItemBooked) {
                                    e.preventDefault();
                                    return;
                                  }
                                  const selectedIds = group.items
                                    .filter(
                                      (it) =>
                                        it.isSelected &&
                                        !activeItemAppointmentMap.has(it.id)
                                    )
                                    .map((it) => it.id);
                                  const itemIdsToDrag =
                                    item.isSelected && selectedIds.length > 1
                                      ? selectedIds
                                      : [item.id];
                                  e.dataTransfer.setData(
                                    'text/plain',
                                    JSON.stringify({
                                      groupId: group.id,
                                      itemId: item.id,
                                      index: itemIdx,
                                    })
                                  );
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedRow({
                                    groupId: group.id,
                                    itemId: item.id,
                                    index: itemIdx,
                                  });
                                  setDraggedItems({
                                    itemIds: itemIdsToDrag,
                                    sourceGroupId: group.id,
                                  });
                                }}
                                onDragEnd={() => {
                                  setDraggedRow(null);
                                  setDraggedItems(null);
                                  setDragOverTarget(null);
                                  setDragOverGroupId(null);
                                }}
                                onDragOver={(e) => {
                                  if (isItemBooked) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (
                                    !dragOverTarget ||
                                    dragOverTarget.groupId !== group.id ||
                                    dragOverTarget.index !== itemIdx
                                  ) {
                                    setDragOverTarget({
                                      groupId: group.id,
                                      index: itemIdx,
                                    });
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!draggedRow) return;

                                  const srcGroupId = draggedRow.groupId;
                                  const srcIndex = draggedRow.index;
                                  const targetGroupId = group.id;
                                  const targetIndex = itemIdx;

                                  if (activeItemAppointmentMap.has(draggedRow.itemId)) {
                                    setDraggedRow(null);
                                    setDraggedItems(null);
                                    setDragOverTarget(null);
                                    setDragOverGroupId(null);
                                    return;
                                  }

                                  if (srcGroupId === targetGroupId) {
                                    if (!isItemBooked && srcIndex !== targetIndex) {
                                      setPlanGroups((prev) =>
                                        prev.map((g) => {
                                          if (g.id !== srcGroupId) return g;
                                          const newItems = [...g.items];
                                          const [moved] = newItems.splice(srcIndex, 1);
                                          newItems.splice(targetIndex, 0, moved);
                                          return { ...g, items: newItems };
                                        })
                                      );
                                    }
                                  } else {
                                    const crossLocked =
                                      (activeGroupAppointmentsMap.get(targetGroupId) || [])
                                        .length > 0 ||
                                      (activeGroupAppointmentsMap.get(srcGroupId) || [])
                                        .length > 0;
                                    if (!crossLocked) {
                                      setPlanGroups((prev) => {
                                        let movedItem: ProposedItem | null = null;
                                        const updated = prev.map((g) => {
                                          if (g.id === srcGroupId) {
                                            const newItems = [...g.items];
                                            const [extracted] = newItems.splice(srcIndex, 1);
                                            movedItem = extracted;
                                            return { ...g, items: newItems };
                                          }
                                          return g;
                                        });
                                        if (!movedItem) return prev;
                                        return updated.map((g) => {
                                          if (g.id === targetGroupId) {
                                            const newItems = [...g.items];
                                            newItems.splice(targetIndex, 0, movedItem!);
                                            return { ...g, items: newItems };
                                          }
                                          return g;
                                        });
                                      });
                                    }
                                  }

                                  setDraggedRow(null);
                                  setDraggedItems(null);
                                  setDragOverTarget(null);
                                  setDragOverGroupId(null);
                                }}
                                style={{
                                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                                  backgroundColor: isInvalidRow
                                    ? 'rgba(239, 68, 68, 0.04)'
                                    : isBeingDragged
                                    ? 'rgba(13, 148, 136, 0.08)'
                                    : item.isSelected
                                    ? 'rgba(13, 148, 136, 0.03)'
                                    : 'var(--bg-card, #ffffff)',
                                  boxShadow: isDragTarget ? '0 -2px 0 0 #0d9488' : undefined,
                                  opacity: isBeingDragged ? 0.45 : 1,
                                  cursor: isItemBooked ? 'default' : 'grab',
                                  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                                }}
                              >
                                {/* Drag Handle & Selection Checkbox */}
                                <td style={{ padding: '8px 4px', verticalAlign: 'middle' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '2px',
                                    }}
                                  >
                                    <Tooltip
                                      content={
                                        isItemBooked
                                          ? t(
                                              'patientTreatmentPlan.calendarDisabledGroupBooked',
                                              'Locked because an appointment is scheduled'
                                            )
                                          : t(
                                              'patientTreatmentPlan.dragToMove',
                                              'Drag to move or reorder'
                                            )
                                      }
                                    >
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          cursor: isItemBooked ? 'not-allowed' : 'grab',
                                          opacity: isItemBooked ? 0.35 : 1,
                                        }}
                                      >
                                        <GripVertical
                                          size={13}
                                          style={{ color: 'var(--text-muted, #94a3b8)' }}
                                        />
                                      </span>
                                    </Tooltip>
                                    <input
                                      type="checkbox"
                                      disabled={isItemBooked}
                                      checked={Boolean(item.isSelected)}
                                      onChange={() =>
                                        handleItemSelectionToggle(group.id, item.id)
                                      }
                                      style={{
                                        width: '14px',
                                        height: '14px',
                                        cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                        opacity: isItemBooked ? 0.45 : 1,
                                        accentColor: 'var(--primary-600, #0d9488)',
                                      }}
                                    />
                                  </div>
                                </td>

                                {/* Treatment: Compact SearchableSelect */}
                                <td style={{ padding: '6px 4px', verticalAlign: 'middle' }}>
                                  <SearchableSelect
                                    compact={true}
                                    disabled={isItemBooked}
                                    options={treatmentOpts}
                                    value={
                                      treatmentOpts.some(
                                        (o) => o.value === currentTreatmentVal
                                      )
                                        ? currentTreatmentVal
                                        : cleanTreatmentName
                                    }
                                    onChange={(val) =>
                                      handleItemTreatmentSelect(group.id, item.id, val)
                                    }
                                    placeholder={t(
                                      'patientTreatmentPlan.treatmentPlaceholder',
                                      'Select treatment...'
                                    )}
                                    searchPlaceholder={t(
                                      'patientTreatmentPlan.treatmentPlaceholder',
                                      'Search treatment...'
                                    )}
                                    triggerStyle={
                                      isTreatmentInvalid
                                        ? {
                                            borderColor: '#ef4444',
                                            boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          }
                                        : isItemBooked
                                        ? {
                                            backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                                            opacity: 0.78,
                                          }
                                        : undefined
                                    }
                                  />
                                </td>

                                {/* OT (teeth number): Clean read-only text display, no # */}
                                <td
                                  style={{
                                    padding: '6px 4px',
                                    verticalAlign: 'middle',
                                    textAlign: 'center',
                                  }}
                                >
                                  {cleanToothStr ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        fontFamily: 'monospace',
                                        color: '#0f766e',
                                        backgroundColor: 'rgba(13, 148, 136, 0.08)',
                                        border: '1px solid rgba(13, 148, 136, 0.25)',
                                        padding: '2px 5px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      {cleanToothStr}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        color: 'var(--text-muted, #94a3b8)',
                                        fontSize: '11px',
                                      }}
                                    >
                                      —
                                    </span>
                                  )}
                                </td>

                                {/* Doctor * Dropdown: Compact SearchableSelect */}
                                <td style={{ padding: '6px 4px', verticalAlign: 'middle' }}>
                                  <SearchableSelect
                                    compact={true}
                                    disabled={isItemBooked}
                                    options={doctorOptions}
                                    value={item.doctorId}
                                    onChange={(val) =>
                                      handleItemDoctorChange(group.id, item.id, val)
                                    }
                                    placeholder={t(
                                      'patientTreatmentPlan.selectDoctor',
                                      'Select Doctor...'
                                    )}
                                    searchPlaceholder={t(
                                      'patientTreatmentPlan.searchDoctor',
                                      'Search doctor...'
                                    )}
                                    triggerStyle={
                                      isDoctorInvalid
                                        ? {
                                            borderColor: '#ef4444',
                                            boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          }
                                        : isItemBooked
                                        ? {
                                            backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                                            opacity: 0.78,
                                          }
                                        : undefined
                                    }
                                  />
                                </td>

                                {/* Service * Dropdown: Compact SearchableSelect */}
                                <td style={{ padding: '6px 4px', verticalAlign: 'middle' }}>
                                  <SearchableSelect
                                    compact={true}
                                    disabled={isItemBooked}
                                    options={
                                      !item.doctorId
                                        ? []
                                        : doctorServices.length > 0
                                        ? doctorServices.map((srv) => ({
                                            value: srv.serviceId,
                                            label: srv.serviceName || srv.serviceId,
                                            sublabel:
                                              srv.customPrice !== undefined
                                                ? `${srv.customPrice} MXN`
                                                : undefined,
                                          }))
                                        : clinicServices.map((srv) => ({
                                            value: srv.id,
                                            label: srv.name,
                                            sublabel: `${srv.price} MXN`,
                                          }))
                                    }
                                    value={item.serviceId}
                                    onChange={(val) =>
                                      handleItemServiceChange(group.id, item.id, val)
                                    }
                                    placeholder={
                                      !item.doctorId
                                        ? t(
                                            'patientTreatmentPlan.selectDoctorFirst',
                                            'Select doctor first...'
                                          )
                                        : doctorServices.length === 0 &&
                                          clinicServices.length === 0
                                        ? t(
                                            'patientTreatmentPlan.noServicesForDoctor',
                                            'No services available'
                                          )
                                        : t(
                                            'patientTreatmentPlan.selectService',
                                            'Select Service...'
                                          )
                                    }
                                    searchPlaceholder={t(
                                      'patientTreatmentPlan.searchService',
                                      'Search service...'
                                    )}
                                    triggerStyle={
                                      isServiceInvalid
                                        ? {
                                            borderColor: '#ef4444',
                                            boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.25)',
                                          }
                                        : isItemBooked
                                        ? {
                                            backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                                            opacity: 0.78,
                                          }
                                        : undefined
                                    }
                                  />
                                </td>

                                {/* Qty Input */}
                                <td
                                  style={{
                                    padding: '6px 2px',
                                    verticalAlign: 'middle',
                                    textAlign: 'center',
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    disabled={isItemBooked}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemQtyChange(group.id, item.id, e.target.value)
                                    }
                                    className="form-control"
                                    style={{
                                      width: '100%',
                                      maxWidth: '42px',
                                      padding: '4px 2px',
                                      fontSize: '12px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: isQtyInvalid
                                        ? '1.5px solid #ef4444'
                                        : '1px solid var(--border-color, #cbd5e1)',
                                      margin: '0 auto',
                                      display: 'block',
                                      backgroundColor: isItemBooked
                                        ? 'var(--bg-surface-muted, #f1f5f9)'
                                        : 'var(--bg-card, #ffffff)',
                                      color: 'var(--text-heading, #0f172a)',
                                      cursor: isItemBooked ? 'not-allowed' : 'text',
                                      opacity: isItemBooked ? 0.78 : 1,
                                    }}
                                  />
                                </td>

                                {/* Price (MXN): Editable input field */}
                                <td
                                  style={{
                                    padding: '6px 4px',
                                    verticalAlign: 'middle',
                                    textAlign: 'right',
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    disabled={isItemBooked}
                                    value={item.unitPrice === 0 ? '' : item.unitPrice}
                                    onChange={(e) =>
                                      handleItemUnitPriceChange(
                                        group.id,
                                        item.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder="0.00"
                                    className="form-control"
                                    style={{
                                      width: '100%',
                                      padding: '4px 4px',
                                      fontSize: '12px',
                                      textAlign: 'right',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: isPriceInvalid
                                        ? '1.5px solid #ef4444'
                                        : '1px solid var(--border-color, #cbd5e1)',
                                      margin: '0 0 0 auto',
                                      display: 'block',
                                      backgroundColor: isItemBooked
                                        ? 'var(--bg-surface-muted, #f1f5f9)'
                                        : 'var(--bg-card, #ffffff)',
                                      color: 'var(--text-heading, #0f172a)',
                                      boxSizing: 'border-box',
                                      cursor: isItemBooked ? 'not-allowed' : 'text',
                                      opacity: isItemBooked ? 0.78 : 1,
                                    }}
                                  />
                                </td>

                                {/* Subtotal Display */}
                                <td
                                  style={{
                                    padding: '6px 6px',
                                    verticalAlign: 'middle',
                                    fontWeight: 700,
                                    color: 'var(--text-heading, #0f172a)',
                                    whiteSpace: 'nowrap',
                                    fontSize: '12px',
                                    textAlign: 'right',
                                  }}
                                >
                                  {item.subtotal.toFixed(2)}
                                </td>

                                {/* Appointment & Delete Actions */}
                                <td
                                  style={{
                                    padding: '6px 4px',
                                    verticalAlign: 'middle',
                                    textAlign: 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    {isSingleServiceAppt && itemAppt ? (
                                      <Tooltip
                                        content={t(
                                          'patientTreatmentPlan.editServiceAppointment',
                                          'Edit Appointment ({{aptNumber}})',
                                          { aptNumber: itemAppt.appointmentNumber }
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            navigate(
                                              `/clinic/appointments/${itemAppt.id}/edit?returnTo=treatment-plan&patientId=${patientId}`
                                            )
                                          }
                                          style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(99, 102, 241, 0.45)',
                                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                            color: '#4338ca',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            padding: 0,
                                          }}
                                          aria-label={t(
                                            'patientTreatmentPlan.editAppointment',
                                            'Edit Appointment'
                                          )}
                                        >
                                          <CalendarCheck size={14} />
                                        </button>
                                      </Tooltip>
                                    ) : isItemBooked ? (
                                      <Tooltip
                                        content={t(
                                          'patientTreatmentPlan.calendarDisabledGroupBooked',
                                          'Appointment already created at the treatment plan level. Use Edit Appointment above.'
                                        )}
                                      >
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            cursor: 'not-allowed',
                                          }}
                                        >
                                          <button
                                            type="button"
                                            disabled
                                            style={{
                                              width: '32px',
                                              height: '32px',
                                              borderRadius: '6px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              border: '1px solid var(--border-color, #cbd5e1)',
                                              backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                                              color: 'var(--text-muted, #94a3b8)',
                                              cursor: 'not-allowed',
                                              opacity: 0.45,
                                              pointerEvents: 'none',
                                              padding: 0,
                                            }}
                                            aria-label={t(
                                              'patientTreatmentPlan.calendarDisabledGroupBooked',
                                              'Appointment already created at the treatment plan level.'
                                            )}
                                          >
                                            <Calendar size={14} />
                                          </button>
                                        </span>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip
                                        content={
                                          !isAccepted
                                            ? createApptDisabledReason
                                            : t(
                                                'patientTreatmentPlan.createAppointment',
                                                'Create appointment'
                                              )
                                        }
                                      >
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            cursor: !isAccepted ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          <button
                                            type="button"
                                            disabled={!isAccepted}
                                            onClick={() =>
                                              handleOpenApptModalForItem(item, group)
                                            }
                                            style={{
                                              width: '32px',
                                              height: '32px',
                                              borderRadius: '6px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              border: !isAccepted
                                                ? '1px solid var(--border-color, #cbd5e1)'
                                                : '1px solid var(--primary-500, #0d9488)',
                                              backgroundColor: !isAccepted
                                                ? 'var(--bg-surface-muted, #f1f5f9)'
                                                : 'rgba(13, 148, 136, 0.08)',
                                              color: !isAccepted
                                                ? 'var(--text-muted, #94a3b8)'
                                                : 'var(--primary-700, #0f766e)',
                                              cursor: !isAccepted ? 'not-allowed' : 'pointer',
                                              opacity: !isAccepted ? 0.45 : 1,
                                              pointerEvents: !isAccepted ? 'none' : 'auto',
                                              transition: 'all 0.15s ease',
                                              padding: 0,
                                            }}
                                            aria-label={t(
                                              'patientTreatmentPlan.createAppointment',
                                              'Create appointment'
                                            )}
                                          >
                                            <Calendar size={14} />
                                          </button>
                                        </span>
                                      </Tooltip>
                                    )}

                                    <Tooltip
                                      content={
                                        isItemBooked
                                          ? t(
                                              'patientTreatmentPlan.deleteServiceDisabledLocked',
                                              'Cannot delete this service because an appointment has already been created for it.'
                                            )
                                          : t(
                                              'patientTreatmentPlan.deleteService',
                                              'Delete Service'
                                            )
                                      }
                                    >
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        <button
                                          type="button"
                                          disabled={isItemBooked}
                                          onClick={() =>
                                            handleRemoveServiceFromGroup(group.id, item.id)
                                          }
                                          style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: isItemBooked
                                              ? '1px solid var(--border-color, #cbd5e1)'
                                              : '1px solid #fecaca',
                                            backgroundColor: isItemBooked
                                              ? 'var(--bg-surface-muted, #f1f5f9)'
                                              : 'rgba(239, 68, 68, 0.08)',
                                            color: isItemBooked
                                              ? 'var(--text-muted, #94a3b8)'
                                              : '#ef4444',
                                            cursor: isItemBooked ? 'not-allowed' : 'pointer',
                                            opacity: isItemBooked ? 0.45 : 1,
                                            pointerEvents: isItemBooked ? 'none' : 'auto',
                                            transition: 'all 0.15s ease',
                                            padding: 0,
                                          }}
                                          aria-label={t(
                                            'patientTreatmentPlan.deleteService',
                                            'Delete Service'
                                          )}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </span>
                                    </Tooltip>
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
            })}
          </div>
        )}

        {/* ─── Grand Total & Save Bar (Requirement 4) ─── */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Summary Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                {t('patientTreatmentPlan.totalVisits', 'Total Visits')}:
              </span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading, #0f172a)' }}>
                {planGroups.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                {t('patientTreatmentPlan.totalProcedures', 'Total Procedures')}:
              </span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading, #0f172a)' }}>
                {planGroups.reduce((acc, g) => acc + g.items.reduce((s, it) => s + it.quantity, 0), 0)}
              </span>
            </div>
          </div>

          {/* Grand Total & Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {t('patientTreatmentPlan.grandTotal', 'Grand Total')}:
              </span>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: 'var(--primary-700, #0f766e)',
                  letterSpacing: '-0.02em',
                }}
              >
                {grandTotal.toFixed(2)} MXN
              </span>
            </div>

            {canEditPlan && (
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: savingPlan ? 'not-allowed' : 'pointer',
                }}
              >
                {savingPlan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>
                  {savingPlan
                    ? t('patientTreatmentPlan.savingPlan', 'Saving...')
                    : t('patientTreatmentPlan.savePlan', 'Save Plan')}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ─── Schedule Appointment Modal (Single Doctor or Multi-Doctor Auto-Division) ─── */}
    {isApptModalOpen && (() => {
      const currentSched = multiDoctorAppts[activeDocTabIdx] || multiDoctorAppts[0];
      const pendingMultiCount = multiDoctorAppts.filter((s) => s.selected && s.status !== 'success').length;
      const anyMultiError = multiDoctorAppts.some((s) => s.selected && s.status === 'error');
      const todayStr = new Date().toISOString().split('T')[0];

      // Determine active doctor schedule, duration, and slots depending on mode
      const activeSched = isMultiDoctorModal ? (multiDoctorAppts[activeDocTabIdx] || multiDoctorAppts[0]) : multiDoctorAppts[0];
      const activeDoctorName = isMultiDoctorModal
        ? activeSched?.doctorName || t('common.unassignedDoctor', 'Doctor')
        : multiDoctorAppts[0]?.doctorName || doctors.find((d) => d.id === apptForm.doctorId)?.name || t('common.unassignedDoctor', 'Doctor');

      const activeServices = isMultiDoctorModal
        ? activeSched?.services || []
        : multiDoctorAppts[0]?.services || [];

      const activeDuration = isMultiDoctorModal
        ? activeSched?.durationMinutes || 30
        : apptForm.durationMinutes || 30;

      const activeSlots = isMultiDoctorModal
        ? activeSched?.availableSlots || []
        : singleSlots;

      const activeSlotsLoading = isMultiDoctorModal
        ? activeSched?.loadingSlots
        : singleSlotsLoading;

      const activeStartTime = isMultiDoctorModal
        ? activeSched?.startTime
        : apptForm.startTime;

      const activeEndTime = isMultiDoctorModal
        ? activeSched?.endTime
        : apptForm.endTime;

      const freeSlotsCount = activeSlots.filter((s) => s.available).length;

      return (
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
            padding: isMobileScreen ? '10px' : '16px',
          }}
          onClick={() => setIsApptModalOpen(false)}
        >
          <div
            className="add-note-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: isMultiDoctorModal ? '1120px' : '1040px',
              height: isMobileScreen ? 'calc(100vh - 28px)' : '84vh',
              maxHeight: isMobileScreen ? 'none' : '760px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                flexShrink: 0,
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(13, 148, 136, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-600, #0d9488)',
                    flexShrink: 0,
                  }}
                >
                  <Calendar size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2
                      style={{
                        fontSize: '17px',
                        fontWeight: 800,
                        margin: 0,
                        color: 'var(--text-heading, #0f172a)',
                        lineHeight: '1.2',
                      }}
                    >
                      {isMultiDoctorModal
                        ? t('patientTreatmentPlan.scheduleAllDoctorAppointments', 'Schedule Doctor Appointments')
                        : t('patientTreatmentPlan.scheduleAppointmentModal', 'Schedule Appointment')}
                    </h2>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted, #64748b)',
                      display: 'block',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t(
                      'patientTreatmentPlan.scheduleSubtitle',
                      'Select date, duration, and time slot to schedule procedure appointments.'
                    )}
                  </span>
                </div>
              </div>

              <Tooltip content={t('common.close', 'Close')}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsApptModalOpen(false)}
                  style={{
                    width: '34px',
                    height: '34px',
                    padding: 0,
                    borderRadius: '8px',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                  }}
                  aria-label={t('common.close', 'Close')}
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            {/* Mobile Segmented Switcher (< 768px) */}
            {isMobileScreen && (
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-muted, #f8fafc)',
                  padding: '6px 10px',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveApptMobileTab('form')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backgroundColor: activeApptMobileTab === 'form' ? 'var(--card-bg, #ffffff)' : 'transparent',
                    color: activeApptMobileTab === 'form' ? 'var(--primary-600, #0d9488)' : 'var(--text-muted, #64748b)',
                    boxShadow: activeApptMobileTab === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={15} />
                  <span>{t('patientTreatmentPlan.tabDetails', 'Details & Notes')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveApptMobileTab('slots')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backgroundColor: activeApptMobileTab === 'slots' ? 'var(--card-bg, #ffffff)' : 'transparent',
                    color: activeApptMobileTab === 'slots' ? 'var(--primary-600, #0d9488)' : 'var(--text-muted, #64748b)',
                    boxShadow: activeApptMobileTab === 'slots' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Clock size={15} />
                  <span>{t('patientTreatmentPlan.tabSlots', 'Available Slots')}</span>
                  {freeSlotsCount > 0 && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(13, 148, 136, 0.15)',
                        color: 'var(--primary-700, #0f766e)',
                      }}
                    >
                      {freeSlotsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Modal Main Split Body */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* ════════════ LEFT PANE: APPOINTMENT DETAILS & NOTES FORM ════════════ */}
              {(!isMobileScreen || activeApptMobileTab === 'form') && (
                <div
                  style={{
                    width: isMobileScreen ? '100%' : '52%',
                    borderRight: isMobileScreen ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    backgroundColor: 'var(--card-bg, #ffffff)',
                  }}
                >
                  <form
                    onSubmit={handleSubmitAppointment}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        overflowY: 'auto',
                        flex: 1,
                      }}
                    >
                      {/* Unassigned Services Excluded Banner */}
                      {unassignedCount > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          <Info size={16} style={{ flexShrink: 0 }} />
                          <span>{t('patientTreatmentPlan.unassignedServicesIgnored', { count: unassignedCount })}</span>
                        </div>
                      )}

                      {/* Multi-Doctor Division Tabs (When > 1 Doctor) */}
                      {isMultiDoctorModal && (
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading, #0f172a)', display: 'block', marginBottom: '8px' }}>
                            {t('patientTreatmentPlan.selectDoctor', 'Doctor Appointments')} ({multiDoctorAppts.length})
                          </label>
                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              overflowX: 'auto',
                              paddingBottom: '4px',
                            }}
                          >
                            {multiDoctorAppts.map((sched, idx) => {
                              const isTabActive = activeDocTabIdx === idx;
                              return (
                                <div
                                  key={sched.doctorId || idx}
                                  onClick={() => setActiveDocTabIdx(idx)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    border: isTabActive
                                      ? '2px solid var(--primary-600, #0d9488)'
                                      : '1px solid var(--border-color, #cbd5e1)',
                                    backgroundColor: isTabActive
                                      ? 'rgba(13, 148, 136, 0.08)'
                                      : 'var(--bg-muted, #f8fafc)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={sched.selected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleUpdateDoctorApptSchedule(idx, 'selected', e.target.checked);
                                    }}
                                    style={{ width: '15px', height: '15px', accentColor: 'var(--primary-600, #0d9488)', cursor: 'pointer' }}
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: isTabActive ? 700 : 600, color: isTabActive ? 'var(--primary-800, #115e59)' : 'var(--text-heading, #0f172a)' }}>
                                        {sched.doctorName}
                                      </span>
                                      {sched.status === 'success' && (
                                        <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                                      )}
                                      {sched.status === 'error' && (
                                        <AlertCircle size={14} style={{ color: '#dc2626' }} />
                                      )}
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                                      {sched.services.length}{' '}
                                      {sched.services.length === 1
                                        ? t('patientTreatmentPlan.procedure', 'procedure')
                                        : t('patientTreatmentPlan.procedures', 'procedures')}
                                      {sched.startTime ? ` · ${sched.startTime}` : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Multi-Doctor Tab Status Banners */}
                      {isMultiDoctorModal && currentSched?.status === 'success' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(22, 163, 74, 0.1)',
                            border: '1px solid rgba(22, 163, 74, 0.3)',
                            color: '#15803d',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                          <div>
                            <div>{t('patientTreatmentPlan.appointmentCreatedForDoctor', { doctorName: currentSched.doctorName })}</div>
                            <div style={{ fontSize: '11.5px', fontWeight: 500, color: '#166534', marginTop: '2px' }}>
                              {currentSched.date} · {currentSched.startTime}–{currentSched.endTime} ({currentSched.durationMinutes} {t('patientTreatmentPlan.minutesShort', 'min')})
                            </div>
                          </div>
                        </div>
                      )}

                      {isMultiDoctorModal && currentSched?.status === 'error' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#b91c1c',
                            fontSize: '12.5px',
                            fontWeight: 500,
                          }}
                        >
                          <AlertCircle size={18} style={{ flexShrink: 0 }} />
                          <span>
                            {t('patientTreatmentPlan.appointmentFailedForDoctor', {
                              doctorName: currentSched.doctorName,
                              error: currentSched.errorMessage || 'Failed to schedule',
                            })}
                          </span>
                        </div>
                      )}

                      {/* Top Read-Only Summary Card: Patient, Doctor & Included Services */}
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-muted, #f8fafc)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        {/* Patient & Doctor Row (Read-Only) */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                            gap: '12px',
                          }}
                        >
                          {/* Patient Info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: 'var(--text-muted, #64748b)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {t('patientTreatmentPlan.patientLabel', 'Patient')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(13, 148, 136, 0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--primary-600, #0d9488)',
                                  flexShrink: 0,
                                }}
                              >
                                <User size={14} />
                              </div>
                              <span
                                style={{
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  color: 'var(--text-heading, #0f172a)',
                                }}
                              >
                                {patientFullName || t('common.unnamed', 'Unnamed Patient')}
                              </span>
                            </div>
                          </div>

                          {/* Doctor Info (Read-Only) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: 'var(--text-muted, #64748b)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {t('patientTreatmentPlan.doctorLabel', 'Doctor')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(13, 148, 136, 0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--primary-600, #0d9488)',
                                  flexShrink: 0,
                                }}
                              >
                                <Stethoscope size={14} />
                              </div>
                              <span
                                style={{
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  color: 'var(--text-heading, #0f172a)',
                                }}
                              >
                                {activeDoctorName}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Included Services Row (Read-Only) */}
                        {activeServices && activeServices.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              borderTop: '1px solid var(--border-color)',
                              paddingTop: '10px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: 'var(--text-muted, #64748b)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {t('patientTreatmentPlan.includedServices', 'Included Services')}
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {activeServices.map((srv) => (
                                <span
                                  key={srv.id}
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(13, 148, 136, 0.08)',
                                    border: '1px solid rgba(13, 148, 136, 0.25)',
                                    color: 'var(--primary-700, #0f766e)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>{srv.treatmentName || 'Treatment'}</span>
                                  {srv.otTeethNumber ? (
                                    <span style={{ opacity: 0.9 }}>{`(OT: ${srv.otTeethNumber})`}</span>
                                  ) : srv.toothNumbers?.length ? (
                                    <span style={{ opacity: 0.9 }}>{`(#${srv.toothNumbers.join(', #')})`}</span>
                                  ) : null}
                                  {srv.quantity > 1 && (
                                    <span style={{ opacity: 0.85, fontWeight: 700 }}>{`x${srv.quantity}`}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Date & Duration Row */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobileScreen ? '1fr' : '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading, #1e293b)', display: 'block', marginBottom: '4px' }}>
                            {t('patientTreatmentPlan.appointmentDate', 'Date')} <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="date"
                            required
                            disabled={isMultiDoctorModal && currentSched?.status === 'success'}
                            min={todayStr}
                            value={isMultiDoctorModal ? currentSched?.date : apptForm.date}
                            onChange={(e) => {
                              const d = e.target.value;
                              if (isMultiDoctorModal) {
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'date', d);
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'startTime', '');
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'endTime', '');
                                loadMultiSlots(activeDocTabIdx, currentSched.doctorId, d, currentSched.durationMinutes);
                              } else {
                                setApptForm((prev) => ({ ...prev, date: d, startTime: '', endTime: '' }));
                                if (apptForm.doctorId) {
                                  loadSingleSlots(apptForm.doctorId, d, apptForm.durationMinutes);
                                }
                              }
                            }}
                            className="input"
                            style={{
                              width: '100%',
                              height: '40px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              fontSize: '13px',
                            }}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading, #1e293b)', display: 'block', marginBottom: '4px' }}>
                            {t('patientTreatmentPlan.duration', 'Duration')}
                          </label>
                          <select
                            disabled={isMultiDoctorModal && currentSched?.status === 'success'}
                            value={isMultiDoctorModal ? currentSched?.durationMinutes : apptForm.durationMinutes}
                            onChange={(e) => {
                              const dur = Number(e.target.value);
                              if (isMultiDoctorModal) {
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'durationMinutes', dur);
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'startTime', '');
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'endTime', '');
                                loadMultiSlots(activeDocTabIdx, currentSched.doctorId, currentSched.date, dur);
                              } else {
                                setApptForm((prev) => ({ ...prev, durationMinutes: dur, startTime: '', endTime: '' }));
                                if (apptForm.doctorId) {
                                  loadSingleSlots(apptForm.doctorId, apptForm.date, dur);
                                }
                              }
                            }}
                            className="input"
                            style={{
                              width: '100%',
                              height: '40px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              fontSize: '13px',
                            }}
                          >
                            <option value={15}>15 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                            <option value={30}>30 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                            <option value={45}>45 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                            <option value={60}>60 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                            <option value={90}>90 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                            <option value={120}>120 {t('patientTreatmentPlan.minutes', 'minutes')}</option>
                          </select>
                        </div>
                      </div>

                      {/* Selected Time Slot Feedback Pill */}
                      {activeStartTime && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(13, 148, 136, 0.08)',
                            border: '1px solid rgba(13, 148, 136, 0.25)',
                            fontSize: '12.5px',
                            color: 'var(--primary-700, #0f766e)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                            <span>
                              <strong>Selected Slot:</strong> {activeStartTime} – {activeEndTime} ({activeDuration} min)
                            </span>
                          </div>
                          {isMobileScreen && (
                            <button
                              type="button"
                              onClick={() => setActiveApptMobileTab('slots')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary-600, #0d9488)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              Change
                            </button>
                          )}
                        </div>
                      )}

                      {/* Appointment Notes (Formatted Numbered List) */}
                      <div>
                        <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading, #1e293b)', display: 'block', marginBottom: '6px' }}>
                          {t('patientTreatmentPlan.appointmentNotes', 'Appointment Notes')}
                        </label>
                        <textarea
                          disabled={isMultiDoctorModal && currentSched?.status === 'success'}
                          value={isMultiDoctorModal ? (currentSched?.notes || '') : apptForm.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isMultiDoctorModal) {
                              handleUpdateDoctorApptSchedule(activeDocTabIdx, 'notes', val);
                            } else {
                              setApptForm((prev) => ({ ...prev, notes: val }));
                            }
                          }}
                          rows={4}
                          placeholder="1. Corona (OT: 18)..."
                          className="input"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            fontSize: '12.5px',
                            lineHeight: '1.5',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    </div>

                    {/* Left Pane Form Footer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-muted, #f8fafc)',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsApptModalOpen(false)}
                        disabled={apptSubmitting}
                        style={{ fontSize: '13px', minHeight: '40px', padding: '0 18px', borderRadius: '8px' }}
                      >
                        {t('patientTreatmentPlan.cancel', 'Cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={apptSubmitting || (isMultiDoctorModal && pendingMultiCount === 0)}
                        className="btn btn-primary"
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          minHeight: '40px',
                          padding: '0 20px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--primary-600, #0d9488)',
                          color: '#ffffff',
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: (apptSubmitting || (isMultiDoctorModal && pendingMultiCount === 0)) ? 'not-allowed' : 'pointer',
                          opacity: (apptSubmitting || (isMultiDoctorModal && pendingMultiCount === 0)) ? 0.6 : 1,
                        }}
                      >
                        {apptSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                        <span>
                          {isMultiDoctorModal
                            ? anyMultiError
                              ? t('patientTreatmentPlan.retrySchedule', 'Retry')
                              : `${t('patientTreatmentPlan.scheduleAllDoctorAppointments', 'Schedule All Appointments')} (${pendingMultiCount})`
                            : t('patientTreatmentPlan.schedule', 'Schedule')}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ════════════ RIGHT PANE: AVAILABLE SLOTS GRID ════════════ */}
              {(!isMobileScreen || activeApptMobileTab === 'slots') && (
                <div
                  style={{
                    width: isMobileScreen ? '100%' : '48%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    backgroundColor: 'var(--bg-muted, #f8fafc)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Slots Pane Header */}
                  <div
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} style={{ color: 'var(--primary-600, #0d9488)' }} />
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-heading, #0f172a)' }}>
                          {t('patientTreatmentPlan.availableSlots', 'Available Slots')} ({activeDuration} {t('patientTreatmentPlan.minutesShort', 'min')})
                        </span>
                      </div>
                      {freeSlotsCount > 0 && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#047857',
                          }}
                        >
                          {freeSlotsCount} {t('patientTreatmentPlan.slotsFree', 'free')}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                      Click on an available slot below to choose the appointment time.
                    </span>
                  </div>

                  {/* Slots Pane Body */}
                  <div
                    style={{
                      padding: '18px',
                      overflowY: 'auto',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {!apptForm.doctorId && !isMultiDoctorModal ? (
                      <div
                        style={{
                          fontSize: '12.5px',
                          color: 'var(--text-muted, #64748b)',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          border: '1px dashed var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <Info size={16} style={{ color: 'var(--primary-600, #0d9488)', flexShrink: 0 }} />
                        <span>{t('patientTreatmentPlan.selectDoctorAndDate', 'Select a doctor and date to view available slots.')}</span>
                      </div>
                    ) : activeSlotsLoading ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '40px 20px',
                          color: 'var(--text-muted, #64748b)',
                          fontSize: '13px',
                        }}
                      >
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary-600, #0d9488)' }} />
                        <span>{t('patientTreatmentPlan.checkingSlots', 'Checking availability...')}</span>
                      </div>
                    ) : !activeSlots || activeSlots.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div
                          style={{
                            fontSize: '12.5px',
                            color: '#b45309',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                          }}
                        >
                          {t('patientTreatmentPlan.noSlotsAvailable', 'No available slots for this doctor on the selected date.')}
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading, #1e293b)', display: 'block', marginBottom: '4px' }}>
                            {t('patientTreatmentPlan.appointmentTime', 'Start Time')} <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="time"
                            required
                            value={activeStartTime}
                            onChange={(e) => {
                              const st = e.target.value;
                              if (isMultiDoctorModal) {
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'startTime', st);
                                handleUpdateDoctorApptSchedule(activeDocTabIdx, 'endTime', calculateEndTime(st, activeDuration));
                              } else {
                                setApptForm((prev) => ({
                                  ...prev,
                                  startTime: st,
                                  endTime: calculateEndTime(st, prev.durationMinutes),
                                }));
                              }
                            }}
                            className="input"
                            style={{
                              width: '100%',
                              height: '40px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              fontSize: '13px',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                          gap: '10px',
                          padding: '2px',
                        }}
                      >
                        {activeSlots.map((slot) => {
                          const isSelected = activeStartTime === slot.startTime;
                          const isBooked = !slot.available;
                          const label = `${slot.startTime}–${slot.endTime}`;

                          if (isBooked) {
                            return (
                              <div
                                key={slot.startTime}
                                title={t('patientTreatmentPlan.slotsBooked', 'Booked')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  padding: '8px 12px',
                                  borderRadius: '9999px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.04)',
                                  color: 'var(--text-muted, #64748b)',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  opacity: 0.5,
                                  cursor: 'not-allowed',
                                  userSelect: 'none',
                                }}
                              >
                                <Lock size={12} style={{ flexShrink: 0 }} />
                                <span>{label}</span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => {
                                if (isMultiDoctorModal) {
                                  handleUpdateDoctorApptSchedule(activeDocTabIdx, 'startTime', slot.startTime);
                                  handleUpdateDoctorApptSchedule(activeDocTabIdx, 'endTime', slot.endTime);
                                } else {
                                  setApptForm((prev) => ({
                                    ...prev,
                                    startTime: slot.startTime,
                                    endTime: slot.endTime,
                                  }));
                                }
                                if (isMobileScreen) {
                                  setActiveApptMobileTab('form');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '8px 12px',
                                borderRadius: '9999px',
                                border: isSelected ? '1.5px solid var(--primary-600, #0d9488)' : '1px solid rgba(13, 148, 136, 0.4)',
                                backgroundColor: isSelected ? 'var(--primary-600, #0d9488)' : 'var(--card-bg, #ffffff)',
                                color: isSelected ? '#ffffff' : 'var(--primary-700, #0f766e)',
                                fontSize: '12px',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 2px 6px rgba(13, 148, 136, 0.25)' : 'none',
                              }}
                            >
                              {isSelected && <Check size={13} style={{ flexShrink: 0 }} />}
                              <span>{label}</span>
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
    })()}

    {/* ─── Delete Treatment Plan Confirmation Modal ─── */}
    {planToDelete && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Trash2 size={18} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-heading, #0f172a)' }}>
              {t('patientTreatmentPlan.deletePlan', 'Delete Plan')}
            </h3>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
            {t(
              'patientTreatmentPlan.deletePlanConfirm',
              'Are you sure you want to delete this treatment plan and all its services?'
            )}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPlanToDelete(null)}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={confirmDeleteGroup}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {t('common.delete', 'Delete')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ─── Add Patient Note Modal (Opens existing notes & clinical note creator) ─── */}
    <AddPatientNoteModal
      isOpen={isAddNoteOpen}
      onClose={() => setIsAddNoteOpen(false)}
      onSuccess={() => setIsAddNoteOpen(false)}
      initialPatientId={patient?.id || null}
      patientsList={patientListForModal}
    />

    {/* ─── Service Completeness Validation Alert Modal ─── */}
    {validationAlertData && (
      <div
        className="modal-backdrop"
        onClick={() => setValidationAlertData(null)}
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
            maxWidth: '560px',
            width: '100%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
          }}
        >
          {/* Alert Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                <AlertTriangle size={20} />
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--text-heading, #0f172a)',
                }}
              >
                {validationAlertData.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setValidationAlertData(null)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                color: 'var(--text-muted, #64748b)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label={t('common.close', 'Close')}
            >
              <X size={16} />
            </button>
          </div>

          {/* Alert Body */}
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
              {validationAlertData.instruction}
            </p>

            {validationAlertData.invalidRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {validationAlertData.invalidRows.map((row) => (
                  <div
                    key={row.itemId}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: '11.5px',
                            fontWeight: 800,
                          }}
                        >
                          {t('patientTreatmentPlan.validationRowLabel', 'Row #{{row}}', {
                            row: row.rowNumber,
                          })}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--text-heading, #0f172a)',
                          }}
                        >
                          {row.isEmptyRow
                            ? t(
                                'patientTreatmentPlan.validationEmptyRow',
                                'Empty row (all fields blank — fill or remove)'
                              )
                            : row.treatmentName || '—'}
                        </span>
                      </div>
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
                          fontWeight: 700,
                          color: '#b91c1c',
                        }}
                      >
                        {t('patientTreatmentPlan.validationMissingLabel', 'Missing')}:
                      </span>
                      {row.missingFields.map((field) => (
                        <span
                          key={field}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #fca5a5',
                            color: '#991b1b',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={() => setValidationAlertData(null)}
              className="btn btn-primary"
              style={{
                minHeight: '42px',
                padding: '0 22px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('patientTreatmentPlan.validationUnderstood', 'Understood')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ─── Treatment Plan Audit History Modal ─── */}
    {(patient?.id || patientId) && (
      <TreatmentPlanAuditModal
        isOpen={auditModalState.isOpen}
        onClose={() => setAuditModalState((prev) => ({ ...prev, isOpen: false }))}
        patientId={patient?.id || patientId || ''}
        initialGroupId={auditModalState.groupId}
      />
    )}
  </div>
);
};
