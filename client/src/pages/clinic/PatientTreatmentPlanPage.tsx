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
} from 'lucide-react';
import api from '../../services/api';
import { ToothIcon } from '../../components/common/ToothIcon';
import { AddPatientNoteModal, PatientOptionItem } from '../../components/clinic/AddPatientNoteModal';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { useToast } from '../../core/context/ToastContext';
import {
  clinicOdontogramService,
  PatientOdontogramResponse,
  PatientOdontogramTreatmentItem,
} from '../../services/clinicOdontogramService';
import { clinicServiceService, ClinicServiceItem } from '../../services/clinicServiceService';
import {
  getToothZoneAndQuadrant,
  getSurfaceDisplayName,
  ToothZone,
  ToothQuadrant,
} from '../../components/clinic/PatientTeethChart';

export interface ProposedItem {
  id: string;
  treatmentName: string;
  color?: string;
  zone: ToothZone;
  quadrant: ToothQuadrant;
  zoneText: string;
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

export const PatientTreatmentPlanPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { error, success } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PatientOdontogramResponse | null>(null);

  // Doctors & Services state
  const [doctors, setDoctors] = useState<DoctorWithServices[]>([]);
  const [clinicServices, setClinicServices] = useState<ClinicServiceItem[]>([]);

  // Proposed Treatment Plan state
  const [planGroups, setPlanGroups] = useState<ProposedGroup[]>([]);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);

  // Drag and Drop state (Supports single and multi-row drag)
  const [draggedItems, setDraggedItems] = useState<{ itemIds: string[]; sourceGroupId: string } | null>(null);
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
    startTime: '09:00',
    endTime: '09:30',
    durationMinutes: 30,
    type: 'PROCEDURE',
    reason: '',
    notes: '',
  });

  // Collapsible Summary Section (Collapsed by default per user specification)
  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(false);

  // Interactive View Controls
  const [selectedTreatment, setSelectedTreatment] = useState<string>('all');

  const fetchPlanData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [patientId, t, error]);

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
      setPlanGroups(savedPlan.groups);
      return;
    }

    // Initial grouping: "One treatment assignement same quadrent of multiple teeth we will consider one row add quantity"
    const rawTreatments = data.treatments || [];
    if (!rawTreatments.length) {
      setPlanGroups([
        {
          id: 'group-1',
          name: 'Visit 1',
          confirmed: false,
          items: [],
        },
      ]);
      return;
    }

    const aggregatedMap = new Map<string, ProposedItem>();

    rawTreatments.forEach((tr, idx) => {
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      const name = tr.treatmentName || tr.treatment?.name || 'Treatment';
      const groupKey = `${name}__${quadrant}__${zone}`;

      if (aggregatedMap.has(groupKey)) {
        const item = aggregatedMap.get(groupKey)!;
        if (!item.toothNumbers.includes(tr.toothNumber)) {
          item.toothNumbers.push(tr.toothNumber);
          item.quantity += 1;
          item.subtotal = item.quantity * item.unitPrice;
        }
      } else {
        const zoneStr = zone === 'POSTERIOR' ? 'ZONA POSTERIOR' : 'ZONA ANTERIOR';
        aggregatedMap.set(groupKey, {
          id: `item-${Date.now()}-${idx}`,
          treatmentName: name,
          color: tr.color || tr.treatment?.color,
          zone,
          quadrant,
          zoneText: `${zoneStr} ${quadrant}`,
          toothNumbers: [tr.toothNumber],
          quantity: 1,
          doctorId: '',
          serviceId: '',
          unitPrice: 0,
          subtotal: 0,
          isSelected: true,
        });
      }
    });

    setPlanGroups([
      {
        id: 'group-1',
        name: 'Visit 1',
        confirmed: false,
        items: Array.from(aggregatedMap.values()),
      },
    ]);
  }, [data]);

  // Group Management Handlers
  const handleAddGroup = () => {
    const nextNum = planGroups.length + 1;
    setPlanGroups((prev) => [
      ...prev,
      {
        id: `group-${Date.now()}`,
        name: `Visit ${nextNum}`,
        confirmed: false,
        items: [],
      },
    ]);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (planGroups.length <= 1) {
      error(t('patientTreatmentPlan.cannotDeleteLastGroup', 'Cannot delete the only visit group.'));
      return;
    }
    const groupToDelete = planGroups.find((g) => g.id === groupId);
    if (!groupToDelete) return;

    if (groupToDelete.items.length > 0) {
      // Move items to the first remaining group
      const targetGroup = planGroups.find((g) => g.id !== groupId)!;
      setPlanGroups((prev) =>
        prev
          .filter((g) => g.id !== groupId)
          .map((g) =>
            g.id === targetGroup.id ? { ...g, items: [...g.items, ...groupToDelete.items] } : g
          )
      );
    } else {
      setPlanGroups((prev) => prev.filter((g) => g.id !== groupId));
    }
  };

  const handleGroupNameChange = (groupId: string, newName: string) => {
    setPlanGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
  };

  const handleGroupConfirmedToggle = (groupId: string) => {
    setPlanGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, confirmed: !g.confirmed } : g))
    );
  };

  // Treatment Item Field Handlers
  const handleItemDoctorChange = (groupId: string, itemId: string, doctorId: string) => {
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
            return {
              ...it,
              serviceId,
              unitPrice: price,
              subtotal: it.quantity * price,
            };
          }),
        };
      })
    );
  };

  const handleItemQtyChange = (groupId: string, itemId: string, qtyRaw: string) => {
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
    setPlanGroups((prev) => {
      const itemsToMove: ProposedItem[] = [];
      const updated = prev.map((g) => {
        if (g.id === sourceGroupId) {
          const remaining: ProposedItem[] = [];
          g.items.forEach((it) => {
            if (itemIds.includes(it.id)) {
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
      success(t('patientTreatmentPlan.planSavedSuccess', 'Proposed treatment plan saved successfully.'));
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

  // Open Appointment Modal for a Group
  const handleOpenApptModalForGroup = (group: ProposedGroup) => {
    const firstDoctor = group.items.find((it) => it.doctorId)?.doctorId || doctors[0]?.id || '';
    const procedureSummary = group.items.map((it) => `${it.treatmentName} (${it.quantity})`).join(', ');
    setApptForm({
      doctorId: firstDoctor,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '09:30',
      durationMinutes: 30,
      type: 'PROCEDURE',
      reason: `${group.name}: ${procedureSummary || t('patientTreatmentPlan.procedures', 'procedures')}`,
      notes: `${group.name} - ${procedureSummary}`,
    });
    setIsApptModalOpen(true);
  };

  // Open Appointment Modal for an Item
  const handleOpenApptModalForItem = (item: ProposedItem, group: ProposedGroup) => {
    const docId = item.doctorId || doctors[0]?.id || '';
    const teethStr = item.toothNumbers.length > 0 ? `#${item.toothNumbers.join(', #')}` : '';
    setApptForm({
      doctorId: docId,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '09:30',
      durationMinutes: 30,
      type: 'PROCEDURE',
      reason: `${item.treatmentName} ${teethStr} (${item.zoneText}) - Qty: ${item.quantity}`,
      notes: `${group.name} - ${item.treatmentName}`,
    });
    setIsApptModalOpen(true);
  };

  // Submit Appointment
  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    if (!apptForm.doctorId) {
      error(t('patientTreatmentPlan.selectDoctor', 'Please select a doctor.'));
      return;
    }
    if (!apptForm.date || !apptForm.startTime || !apptForm.endTime) {
      error(t('clinicAppointments.fillRequired', 'Please fill in all required date and time fields.'));
      return;
    }

    setApptSubmitting(true);
    try {
      await api.post('/clinic/appointments', {
        patientId,
        doctorId: apptForm.doctorId,
        date: apptForm.date,
        startTime: apptForm.startTime,
        endTime: apptForm.endTime,
        durationMinutes: apptForm.durationMinutes,
        type: apptForm.type,
        reason: apptForm.reason,
        notes: apptForm.notes,
      });
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

  // Arch & Zone Statistics for active selection
  const archStats = useMemo(() => {
    const q1 = quadrantsData.find((q) => q.key === 'Q1')?.totalCount || 0;
    const q2 = quadrantsData.find((q) => q.key === 'Q2')?.totalCount || 0;
    const q3 = quadrantsData.find((q) => q.key === 'Q3')?.totalCount || 0;
    const q4 = quadrantsData.find((q) => q.key === 'Q4')?.totalCount || 0;

    let posteriorCount = 0;
    let anteriorCount = 0;
    quadrantsData.forEach((q) => {
      posteriorCount += q.posterior.length;
      anteriorCount += q.anterior.length;
    });

    return {
      total: activeTreatments.length,
      maxilla: q1 + q2,
      mandible: q4 + q3,
      posterior: posteriorCount,
      anterior: anteriorCount,
    };
  }, [quadrantsData, activeTreatments]);

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

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
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
          <button
            type="button"
            onClick={() => navigate('/clinic/patients')}
            className="btn btn-secondary"
            style={{
              width: '38px',
              height: '38px',
              padding: 0,
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={t('patientTreatmentPlan.backToPatients', 'Back to Patients')}
          >
            <ArrowLeft size={18} />
          </button>
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
              padding: '9px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              minHeight: '40px',
            }}
          >
            <FileText size={16} />
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
              padding: '9px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              minHeight: '40px',
            }}
          >
            <ToothIcon size={16} />
            <span>{t('patientTreatmentPlan.viewOdontogram', 'View Odontogram')}</span>
          </button>
        </div>
      </div>

      {/* ─── Patient Basic Details (Only Name & Contact Info) ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          {/* Patient Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-primary-bg, rgba(13, 148, 136, 0.12))',
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
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {t('patientTreatmentPlan.name', 'Patient Name')}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-heading, #0f172a)',
                  marginTop: '2px',
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
              gap: '24px',
              flexWrap: 'wrap',
            }}
          >
            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Phone size={16} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.phone', 'Phone')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient.phoneNumber
                    ? `${patient.phoneCountryCode || '+52'} ${patient.phoneNumber}`
                    : '—'}
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={16} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.email', 'Email')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient.email || '—'}
                </div>
              </div>
            </div>
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
                {/* Arch & Zone Quick Metrics Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    padding: '12px 18px',
                    backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                      {t('patientTreatmentPlan.upperArch', 'Maxilla (Upper Arch)')}:
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: archStats.maxilla > 0 ? 'var(--text-heading, #0f172a)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {archStats.maxilla}
                    </span>
                  </div>
                  <span style={{ color: 'var(--border-color, #cbd5e1)' }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                      {t('patientTreatmentPlan.lowerArch', 'Mandible (Lower Arch)')}:
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: archStats.mandible > 0 ? 'var(--text-heading, #0f172a)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {archStats.mandible}
                    </span>
                  </div>
                  <span style={{ color: 'var(--border-color, #cbd5e1)' }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                      {t('patientTreatmentPlan.posteriorZone', 'Posterior')}:
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: archStats.posterior > 0 ? 'var(--primary-600, #0d9488)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {archStats.posterior}
                    </span>
                  </div>
                  <span style={{ color: 'var(--border-color, #cbd5e1)' }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                      {t('patientTreatmentPlan.anteriorZone', 'Anterior')}:
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: archStats.anterior > 0 ? 'var(--primary-600, #0d9488)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {archStats.anterior}
                    </span>
                  </div>
                </div>

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
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                                  }}
                                                >
                                                  #{item.toothNumber}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                                                  {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                    }}
                                                  >
                                                    {item.treatmentName}
                                                  </span>
                                                </div>
                                              </div>

                                              <span
                                                style={{
                                                  fontSize: '10.5px',
                                                  fontWeight: 700,
                                                  padding: '2px 8px',
                                                  borderRadius: '10px',
                                                  backgroundColor: statusBg,
                                                  color: statusColor,
                                                }}
                                              >
                                                {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                              </span>
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
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                                  }}
                                                >
                                                  #{item.toothNumber}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                                                  {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                    }}
                                                  >
                                                    {item.treatmentName}
                                                  </span>
                                                </div>
                                              </div>

                                              <span
                                                style={{
                                                  fontSize: '10.5px',
                                                  fontWeight: 700,
                                                  padding: '2px 8px',
                                                  borderRadius: '10px',
                                                  backgroundColor: statusBg,
                                                  color: statusColor,
                                                }}
                                              >
                                                {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                              </span>
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
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                                  }}
                                                >
                                                  #{item.toothNumber}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                                                  {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                    }}
                                                  >
                                                    {item.treatmentName}
                                                  </span>
                                                </div>
                                              </div>

                                              <span
                                                style={{
                                                  fontSize: '10.5px',
                                                  fontWeight: 700,
                                                  padding: '2px 8px',
                                                  borderRadius: '10px',
                                                  backgroundColor: statusBg,
                                                  color: statusColor,
                                                }}
                                              >
                                                {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                              </span>
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
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-surface, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                                  }}
                                                >
                                                  #{item.toothNumber}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                                                  {getSurfaceDisplayName(item.surface, item.toothNumber)}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                    }}
                                                  >
                                                    {item.treatmentName}
                                                  </span>
                                                </div>
                                              </div>

                                              <span
                                                style={{
                                                  fontSize: '10.5px',
                                                  fontWeight: 700,
                                                  padding: '2px 8px',
                                                  borderRadius: '10px',
                                                  backgroundColor: statusBg,
                                                  color: statusColor,
                                                }}
                                              >
                                                {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                                              </span>
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
        overflow: 'hidden',
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
              {t('patientTreatmentPlan.proposedPlanTitle', 'Proposed Treatment Plan')}
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
                'Group the proposed treatments into visits to discuss them with the patient. Each group shows its own subtotal.'
              )}
            </div>
          </div>
        </div>

        {/* Add Group Action Button */}
        <button
          type="button"
          onClick={handleAddGroup}
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--primary-700, #0f766e)',
            borderColor: 'var(--primary-300, #5eead4)',
            backgroundColor: 'rgba(13, 148, 136, 0.04)',
            minHeight: '40px',
          }}
        >
          <Layers size={16} />
          <span>{t('patientTreatmentPlan.addGroup', 'Add group')}</span>
        </button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ─── Groups List (Requirement 1 & 2: Visits, Drag-and-Drop) ─── */}
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
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              {t(
                'patientTreatmentPlan.noTreatmentsInPlan',
                'No planned treatments to organize yet. Mark treatments on the Odontogram first.'
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {planGroups.map((group) => {
              const groupSubtotal = group.items.reduce(
                (sum, it) => sum + (it.subtotal || 0),
                0
              );
              const isDragOver = dragOverGroupId === group.id;
              const selectedCount = group.items.filter((it) => it.isSelected).length;

              return (
                <div
                  key={group.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverGroupId === group.id) setDragOverGroupId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverGroupId(null);
                    if (draggedItems) {
                      handleMoveItems(draggedItems.itemIds, draggedItems.sourceGroupId, group.id);
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
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
                  }}
                >
                  {/* Group Header Bar (Visit Name, Items Count, Subtotal, Confirmed, Actions) */}
                  <div
                    style={{
                      padding: '12px 18px',
                      backgroundColor: 'var(--bg-surface-muted, #f0f7ff)',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Layers Icon + Editable Group Title + Count + Subtotal + Confirmed */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary-700, #0f766e)',
                          flexShrink: 0,
                        }}
                      >
                        <Layers size={16} />
                      </div>

                      {/* Editable Group Title Input */}
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                        placeholder="Visit 1"
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          color: 'var(--text-heading, #0f172a)',
                          width: '160px',
                        }}
                      />

                      {/* Items Count Pill */}
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          color: 'var(--text-muted, #64748b)',
                        }}
                      >
                        {group.items.length}{' '}
                        {group.items.length === 1
                          ? t('patientTreatmentPlan.itemCount', 'item')
                          : t('patientTreatmentPlan.itemsCount', 'items')}
                      </span>

                      {/* Group Subtotal Display */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                          {t('patientTreatmentPlan.groupSubtotal', 'Group subtotal')}:
                        </span>
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 800,
                            color:
                              groupSubtotal > 0
                                ? 'var(--primary-700, #0f766e)'
                                : 'var(--text-heading, #0f172a)',
                          }}
                        >
                          {groupSubtotal.toFixed(2)} MXN
                        </span>
                      </div>

                      {/* Confirmed Checkbox */}
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--text-main, #334155)',
                          cursor: 'pointer',
                          marginLeft: '8px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={group.confirmed}
                          onChange={() => handleGroupConfirmedToggle(group.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: 'var(--primary-600, #0d9488)',
                          }}
                        />
                        <span>{t('patientTreatmentPlan.confirmed', 'Confirmed')}</span>
                      </label>
                    </div>

                    {/* Right: Batch Move (if selected) + Create Appointment Button + Delete Group Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedCount > 0 && planGroups.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-700, #0f766e)', whiteSpace: 'nowrap' }}>
                            {selectedCount} {t('patientTreatmentPlan.selected', 'selected')}
                          </span>
                          <div style={{ width: '150px' }}>
                            <SearchableSelect
                              options={planGroups
                                .filter((g) => g.id !== group.id)
                                .map((targetG) => ({
                                  value: targetG.id,
                                  label: targetG.name,
                                }))}
                              value=""
                              onChange={(targetGId) => {
                                if (targetGId) {
                                  const selectedIds = group.items.filter((it) => it.isSelected).map((it) => it.id);
                                  handleMoveItems(selectedIds, group.id, targetGId);
                                }
                              }}
                              placeholder={t('patientTreatmentPlan.moveToVisit', 'Move to...')}
                              searchPlaceholder={t('patientTreatmentPlan.searchVisit', 'Search visit...')}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenApptModalForGroup(group)}
                        className="btn btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--primary-700, #0f766e)',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--primary-300, #5eead4)',
                        }}
                      >
                        <Calendar size={14} />
                        <span>{t('patientTreatmentPlan.createAppointment', 'Create appointment')}</span>
                      </button>

                      {planGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fff1f2',
                            color: '#be123c',
                            cursor: 'pointer',
                          }}
                          title={t('patientTreatmentPlan.deleteGroup', 'Delete group')}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ─── Group Treatment Items Table (Requirement 2 & 3) ─── */}
                  {group.items.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 20px',
                        textAlign: 'center',
                        color: 'var(--text-muted, #94a3b8)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                      }}
                    >
                      <Layers size={24} style={{ margin: '0 auto 6px', opacity: 0.4 }} />
                      <div style={{ fontSize: '12.5px', fontWeight: 500 }}>
                        {t(
                          'patientTreatmentPlan.dropHere',
                          'Drop treatment here to move to this visit'
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="table-responsive"
                      style={{
                        overflowX: 'auto',
                        width: '100%',
                        WebkitOverflowScrolling: 'touch',
                        minHeight: '260px',
                      }}
                    >
                      <table
                        className="table"
                        style={{
                          width: '100%',
                          minWidth: '920px',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          fontSize: '13px',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--table-th-bg, #f8fafc)',
                              borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            }}
                          >
                            <th style={{ width: '48px', padding: '10px 14px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={group.items.length > 0 && group.items.every((it) => it.isSelected)}
                                onChange={(e) => handleGroupSelectAllToggle(group.id, e.target.checked)}
                                title={t('patientTreatmentPlan.selectAll', 'Select all')}
                                style={{
                                  width: '15px',
                                  height: '15px',
                                  cursor: 'pointer',
                                  accentColor: 'var(--primary-600, #0d9488)',
                                }}
                              />
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px' }}>
                              {t('patientTreatmentPlan.treatmentColumn', 'Treatment')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px' }}>
                              {t('patientTreatmentPlan.zoneQuadrantColumn', 'Zone / Quadrant')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '70px', textAlign: 'center' }}>
                              {t('patientTreatmentPlan.qtyColumn', 'Qty')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '210px' }}>
                              {t('patientTreatmentPlan.doctorColumn', 'Doctor *')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '230px' }}>
                              {t('patientTreatmentPlan.serviceColumn', 'Service *')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '120px' }}>
                              {t('patientTreatmentPlan.unitPriceColumn', 'Unit Price')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '120px' }}>
                              {t('patientTreatmentPlan.subtotalColumn', 'Subtotal')}
                            </th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '12px', width: '70px', textAlign: 'center' }}>
                              {t('patientTreatmentPlan.appointmentColumn', 'Appointment')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => {
                            const isBeingDragged = Boolean(draggedItems?.itemIds.includes(item.id));
                            const selectedDoctor = doctors.find((d) => d.id === item.doctorId);
                            const doctorServices = selectedDoctor?.services || [];

                            return (
                              <tr
                                key={item.id}
                                draggable
                                onDragStart={(e) => {
                                  const selectedIds = group.items.filter((it) => it.isSelected).map((it) => it.id);
                                  const itemIdsToDrag =
                                    item.isSelected && selectedIds.length > 1 ? selectedIds : [item.id];
                                  e.dataTransfer.setData('text/plain', JSON.stringify(itemIdsToDrag));
                                  setDraggedItems({ itemIds: itemIdsToDrag, sourceGroupId: group.id });
                                }}
                                onDragEnd={() => {
                                  setDraggedItems(null);
                                  setDragOverGroupId(null);
                                }}
                                style={{
                                  borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                                  backgroundColor: isBeingDragged
                                    ? 'rgba(13, 148, 136, 0.08)'
                                    : item.isSelected
                                    ? 'rgba(13, 148, 136, 0.03)'
                                    : 'var(--bg-card, #ffffff)',
                                  opacity: isBeingDragged ? 0.6 : 1,
                                  cursor: 'grab',
                                  transition: 'background-color 0.15s ease',
                                }}
                              >
                                {/* Drag Handle & Selection Checkbox */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <span title={t('patientTreatmentPlan.dragToMove', 'Drag to move between visits')} style={{ display: 'inline-flex', cursor: 'grab' }}>
                                      <GripVertical
                                        size={15}
                                        style={{ color: 'var(--text-muted, #94a3b8)' }}
                                      />
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.isSelected)}
                                      onChange={() => handleItemSelectionToggle(group.id, item.id)}
                                      style={{
                                        width: '15px',
                                        height: '15px',
                                        cursor: 'pointer',
                                        accentColor: 'var(--primary-600, #0d9488)',
                                      }}
                                    />
                                  </div>
                                </td>

                                {/* Treatment Name + Tooth Pills */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {item.color && (
                                      <span
                                        style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          backgroundColor: item.color,
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                    <span style={{ fontWeight: 700, color: 'var(--text-heading, #0f172a)' }}>
                                      {item.treatmentName}
                                    </span>
                                    {item.toothNumbers.length > 0 && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          fontFamily: 'monospace',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                                          border: '1px solid var(--border-color, #e2e8f0)',
                                          color: 'var(--text-muted, #64748b)',
                                        }}
                                      >
                                        #{item.toothNumbers.join(', #')}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Zone / Quadrant */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted, #64748b)', fontSize: '12px' }}>
                                  {item.zoneText}
                                </td>

                                {/* Qty Input */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleItemQtyChange(group.id, item.id, e.target.value)}
                                    className="form-control"
                                    style={{
                                      width: '56px',
                                      padding: '5px 6px',
                                      fontSize: '13px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color, #cbd5e1)',
                                    }}
                                  />
                                </td>

                                {/* Doctor * Dropdown */}
                                <td style={{ padding: '8px 10px', verticalAlign: 'middle', width: '210px', minWidth: '180px' }}>
                                  <SearchableSelect
                                    options={doctorOptions}
                                    value={item.doctorId}
                                    onChange={(val) => handleItemDoctorChange(group.id, item.id, val)}
                                    placeholder={t('patientTreatmentPlan.selectDoctor', 'Select Doctor...')}
                                    searchPlaceholder={t('patientTreatmentPlan.searchDoctor', 'Search doctor...')}
                                  />
                                </td>

                                {/* Service * Dropdown (Loaded based on selected doctor) */}
                                <td style={{ padding: '8px 10px', verticalAlign: 'middle', width: '230px', minWidth: '200px' }}>
                                  <SearchableSelect
                                    options={doctorServices.map((srv) => {
                                      const price = srv.customPrice ?? srv.basePrice;
                                      return {
                                        value: srv.serviceId,
                                        label: srv.serviceName || srv.serviceId,
                                        badge: price !== undefined ? `${price.toFixed(2)} MXN` : undefined,
                                      };
                                    })}
                                    value={item.serviceId}
                                    onChange={(val) => handleItemServiceChange(group.id, item.id, val)}
                                    disabled={!item.doctorId}
                                    placeholder={
                                      !item.doctorId
                                        ? t('patientTreatmentPlan.selectDoctorFirst', 'Select doctor first...')
                                        : doctorServices.length === 0
                                        ? t('patientTreatmentPlan.noServicesForDoctor', 'No services for doctor')
                                        : t('patientTreatmentPlan.selectService', 'Select Service...')
                                    }
                                    searchPlaceholder={t('patientTreatmentPlan.searchService', 'Search service...')}
                                  />
                                </td>

                                {/* Unit Price Input */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <span
                                      style={{
                                        position: 'absolute',
                                        left: '8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: 'var(--text-muted, #94a3b8)',
                                      }}
                                    >
                                      MXN
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={item.unitPrice}
                                      onChange={(e) => handleItemUnitPriceChange(group.id, item.id, e.target.value)}
                                      className="form-control"
                                      style={{
                                        paddingLeft: '38px',
                                        paddingRight: '8px',
                                        paddingTop: '5px',
                                        paddingBottom: '5px',
                                        fontSize: '12.5px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color, #cbd5e1)',
                                        width: '100%',
                                        fontWeight: 600,
                                      }}
                                    />
                                  </div>
                                </td>

                                {/* Subtotal Display */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-heading, #0f172a)' }}>
                                  {item.subtotal.toFixed(2)} MXN
                                </td>

                                {/* Appointment Calendar Button */}
                                <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApptModalForItem(item, group)}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--primary-300, #5eead4)',
                                      backgroundColor: 'rgba(13, 148, 136, 0.08)',
                                      color: 'var(--primary-700, #0f766e)',
                                      cursor: 'pointer',
                                    }}
                                    title={t('patientTreatmentPlan.createAppointment', 'Create appointment')}
                                  >
                                    <Calendar size={15} />
                                  </button>
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

            <button
              type="button"
              onClick={handleSavePlan}
              disabled={savingPlan}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                minHeight: '42px',
                backgroundColor: 'var(--primary-600, #0d9488)',
                color: '#ffffff',
                border: 'none',
                cursor: savingPlan ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(13, 148, 136, 0.25)',
              }}
            >
              {savingPlan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>
                {savingPlan
                  ? t('patientTreatmentPlan.savingPlan', 'Saving...')
                  : t('patientTreatmentPlan.savePlan', 'Save Plan')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* ─── Schedule Appointment Modal (Option A) ─── */}
    {isApptModalOpen && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          className="card"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} style={{ color: 'var(--primary-600, #0d9488)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-heading, #0f172a)' }}>
                {t('patientTreatmentPlan.scheduleAppointmentModal', 'Schedule Appointment')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsApptModalOpen(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-muted, #64748b)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Form Body */}
          <form onSubmit={handleSubmitAppointment}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Patient Name Display */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                  {t('patientTreatmentPlan.name', 'Patient Name')}
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: 'var(--text-heading, #0f172a)',
                  }}
                >
                  {patientFullName || t('common.unnamed', 'Unnamed Patient')}
                </div>
              </div>

              {/* Doctor Select */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                  {t('patientTreatmentPlan.doctorColumn', 'Doctor *')}
                </label>
                <SearchableSelect
                  options={doctorOptions}
                  value={apptForm.doctorId}
                  onChange={(val) => setApptForm((prev) => ({ ...prev, doctorId: val }))}
                  placeholder={t('patientTreatmentPlan.selectDoctor', 'Select Doctor...')}
                  searchPlaceholder={t('patientTreatmentPlan.searchDoctor', 'Search doctor...')}
                />
              </div>

              {/* Date & Time Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                    {t('patientTreatmentPlan.appointmentDate', 'Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={apptForm.date}
                    onChange={(e) => setApptForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="form-control"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                    {t('patientTreatmentPlan.appointmentTime', 'Start Time *')}
                  </label>
                  <input
                    type="time"
                    required
                    value={apptForm.startTime}
                    onChange={(e) => {
                      const st = e.target.value;
                      // auto calculate 30 min end time
                      const [h, m] = st.split(':').map(Number);
                      if (!isNaN(h) && !isNaN(m)) {
                        const totalM = h * 60 + m + apptForm.durationMinutes;
                        const endH = String(Math.floor(totalM / 60) % 24).padStart(2, '0');
                        const endM = String(totalM % 60).padStart(2, '0');
                        setApptForm((prev) => ({ ...prev, startTime: st, endTime: `${endH}:${endM}` }));
                      } else {
                        setApptForm((prev) => ({ ...prev, startTime: st }));
                      }
                    }}
                    className="form-control"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              {/* Reason / Treatment */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                  {t('patientTreatmentPlan.appointmentReason', 'Reason / Treatment')}
                </label>
                <input
                  type="text"
                  value={apptForm.reason}
                  onChange={(e) => setApptForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Visit 1: Corona, Ionomero"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '4px' }}>
                  {t('patientTreatmentPlan.appointmentNotes', 'Appointment Notes')}
                </label>
                <textarea
                  value={apptForm.notes}
                  onChange={(e) => setApptForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '13px',
                  }}
                />
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
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsApptModalOpen(false)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {t('patientTreatmentPlan.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={apptSubmitting}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: 'var(--primary-600, #0d9488)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {apptSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
                <span>{t('patientTreatmentPlan.schedule', 'Schedule')}</span>
              </button>
            </div>
          </form>
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
  </div>
);
};
