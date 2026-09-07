import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  CircleDot,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { Tooltip } from '../common/Tooltip';
import api from '../../services/api';
import { workOrderService, CreateWorkOrderPayload } from '../../services/workOrderService';
import { doctorService, DoctorListItem } from '../../services/doctor.service';

interface ProcessFormItem {
  tempId: string;
  processId?: string;
  processName: string;
  processType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
  technicianId?: string;
  doctorId?: string;
  sequence: number;
  isVerification: boolean;
  status: 'NOT_STARTED';
}

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId?: string;
}

export const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branchId,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Active Tab: 1 (Order Details), 2 (Process Steps), 3 (Payments)
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);

  // Reference data
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string; designation?: string }>>([]);
  const [labAdmins, setLabAdmins] = useState<Array<{ id: string; name: string; designation?: string }>>([]);
  const [availableProcesses, setAvailableProcesses] = useState<any[]>([]);
  const [folioPreview, setFolioPreview] = useState<string>('---');
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [showConfirmAssignModal, setShowConfirmAssignModal] = useState(false);

  // Tab 1: Form Fields
  const [doctorId, setDoctorId] = useState('');
  const [patient, setPatient] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [prosthesisTypeId, setProsthesisTypeId] = useState('');
  const [specification, setSpecification] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');

  // Tab 2: Process Steps
  const [processList, setProcessList] = useState<ProcessFormItem[]>([]);
  const [showAddProcess, setShowAddProcess] = useState(false);
  const [newProcessId, setNewProcessId] = useState('');
  const [newProcessTechnicianId, setNewProcessTechnicianId] = useState('');

  // Tab 3: Payments
  const [totalQuote, setTotalQuote] = useState('0');
  const [initialPayment, setInitialPayment] = useState('0');
  const [paymentReferences, setPaymentReferences] = useState<string[]>([]);
  const [refInput, setRefInput] = useState('');

  // Validation & Submission
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'create' | 'createAndAssign' | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(1);
      setDoctorId('');
      setPatient('');
      setFileNumber('');
      setBoxNumber('');
      setDeliveryDate('');
      setProsthesisTypeId('');
      setSpecification('');
      setColor('');
      setNotes('');
      setProcessList([]);
      setShowAddProcess(false);
      setNewProcessId('');
      setNewProcessTechnicianId('');
      setTotalQuote('0');
      setInitialPayment('0');
      setPaymentReferences([]);
      setRefInput('');
      setErrors({});
      loadReferenceData();
    }
  }, [isOpen, branchId]);

  const loadReferenceData = useCallback(async () => {
    try {
      setLoadingRefs(true);
      const [doctorsRes, ptRes, techRes, adminRes, procRes, folioRes] = await Promise.all([
        doctorService.getAll({ branchId }),
        api.get('/lab/prosthesis-types', { params: branchId ? { branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/users/technicians', { params: branchId ? { branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/users/admin', { params: branchId ? { branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/processes', { params: branchId ? { branchId } : undefined }).catch(() => ({ data: [] })),
        workOrderService.getNextFolio(branchId).catch(() => ({ folioNumber: '---' })),
      ]);

      const activeDocs = Array.isArray(doctorsRes) ? doctorsRes.filter((d) => d.isActive) : [];
      setDoctors(activeDocs);

      const rawPt = Array.isArray(ptRes.data) ? ptRes.data : (ptRes.data as any)?.data || [];
      setProsthesisTypes(rawPt);

      const rawTechs = Array.isArray(techRes.data) ? techRes.data : (techRes.data as any)?.data || [];
      const parsedTechs = rawTechs.map((tech: any) => ({
        id: tech.user?.id || tech.id,
        name: tech.user?.name || tech.name || 'Technician',
        designation: tech.roles?.[0] || tech.role || tech.designation || undefined,
      }));
      setTechnicians(parsedTechs);

      const rawAdmins = Array.isArray(adminRes.data) ? adminRes.data : (adminRes.data as any)?.data || [];
      const parsedAdmins = rawAdmins.map((admin: any) => ({
        id: admin.user?.id || admin.id,
        name: admin.user?.name || admin.name || 'Lab Admin',
        designation: admin.role || admin.roles?.[0] || admin.designation || undefined,
      }));
      setLabAdmins(parsedAdmins);

      const rawProcs = Array.isArray(procRes.data) ? procRes.data : (procRes.data as any)?.data || [];
      setAvailableProcesses(rawProcs);

      if (folioRes?.folioNumber) {
        setFolioPreview(folioRes.folioNumber);
      }
    } catch (err) {
      console.error('Failed to load reference data for work order modal', err);
      toast.error(t('workOrders.alerts.loadRefsFailed', 'Failed to load reference data'));
    } finally {
      setLoadingRefs(false);
    }
  }, [branchId, t, toast]);

  // Selected doctor record
  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d.id === doctorId);
  }, [doctors, doctorId]);

  // Handle Prosthesis Type selection
  const handleProsthesisTypeChange = (ptId: string) => {
    setProsthesisTypeId(ptId);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.prosthesisTypeId;
      return copy;
    });

    const pt = prosthesisTypes.find((p) => p.id === ptId);
    if (pt) {
      // Auto-populate default process sequence from recipe
      if (Array.isArray(pt.processAssignments) && pt.processAssignments.length > 0) {
        const sorted = [...pt.processAssignments].sort(
          (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0),
        );
        const steps: ProcessFormItem[] = sorted.map((item, idx) => {
          const proc = item.process || item;
          const isExt = proc.type === 'EXTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('external');
          const isInt = proc.type === 'INTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('internal');
          const isVer = isExt || isInt || proc.name?.toLowerCase().includes('verif');
          const pType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' = isExt
            ? 'EXTERNAL_VERIFICATION'
            : isInt
            ? 'INTERNAL_VERIFICATION'
            : 'PRODUCTION';

          let preselectedAssignee: string | undefined = undefined;
          if (isExt) {
            preselectedAssignee = undefined;
          } else if (isInt) {
            // Internal verification: display all admins not technician with preselect
            if (proc.defaultTechnicianId && labAdmins.some((a) => a.id === proc.defaultTechnicianId)) {
              preselectedAssignee = proc.defaultTechnicianId;
            } else if (labAdmins.length > 0) {
              preselectedAssignee = labAdmins[0].id;
            }
          } else {
            // Production: display all technician and admin in the dropdown, assigned person is preselected
            if (proc.defaultTechnicianId) {
              preselectedAssignee = proc.defaultTechnicianId;
            }
          }

          return {
            tempId: `step-${idx}-${Date.now()}`,
            processId: proc.id,
            processName: proc.name || '',
            processType: pType,
            technicianId: isExt ? undefined : preselectedAssignee,
            doctorId: isExt ? (doctorId || undefined) : undefined,
            sequence: idx,
            isVerification: isVer,
            status: 'NOT_STARTED',
          };
        });
        setProcessList(steps);
      } else {
        setProcessList([]);
      }
    }
  };

  // Strictly validate Tab 1 mandatory fields
  const validateTab1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!doctorId) {
      errs.doctorId = t('workOrders.validation.doctorRequired', 'Doctor is required');
    }
    if (!prosthesisTypeId) {
      errs.prosthesisTypeId = t('workOrders.validation.prosthesisRequired', 'Prosthesis type is required');
    }
    if (!specification.trim()) {
      errs.specification = t('workOrders.validation.specificationRequired', 'Specification is required');
    }
    if (!color.trim()) {
      errs.color = t('workOrders.validation.colorRequired', 'Color is required');
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(t('workOrders.validation.fillMandatoryFirst', 'Please fill all mandatory fields in Order Details'));
      return false;
    }
    return true;
  };

  // Tab navigation guard
  const handleTabClick = (tab: 1 | 2 | 3) => {
    if (tab === 1) {
      setActiveTab(1);
      return;
    }
    if (validateTab1()) {
      setActiveTab(tab);
    }
  };

  // Process list reordering
  const moveProcess = (index: number, direction: 'up' | 'down') => {
    const list = [...processList];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    [list[index], list[targetIdx]] = [list[targetIdx], list[index]];
    setProcessList(list.map((p, i) => ({ ...p, sequence: i })));
  };

  const removeProcess = (index: number) => {
    const list = processList.filter((_, i) => i !== index);
    setProcessList(list.map((p, i) => ({ ...p, sequence: i })));
  };

  const updateProcessTechnician = (index: number, techId: string) => {
    setProcessList((prev) =>
      prev.map((p, i) => (i === index ? { ...p, technicianId: techId } : p)),
    );
  };

  // Handle adding new process step
  const handleSelectNewProcess = (procId: string) => {
    setNewProcessId(procId);
    const proc = availableProcesses.find((p) => p.id === procId);
    if (!proc) return;

    const isExt = proc.type === 'EXTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('external');
    const isInt = proc.type === 'INTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('internal');

    if (isExt) {
      setNewProcessTechnicianId('');
    } else if (isInt) {
      // Internal verification: preselect default admin or first admin
      if (proc.defaultTechnicianId && labAdmins.some((a) => a.id === proc.defaultTechnicianId)) {
        setNewProcessTechnicianId(proc.defaultTechnicianId);
      } else if (labAdmins.length > 0) {
        setNewProcessTechnicianId(labAdmins[0].id);
      } else {
        setNewProcessTechnicianId('');
      }
    } else {
      // Production: preselect default technician/admin if set
      if (proc.defaultTechnicianId) {
        setNewProcessTechnicianId(proc.defaultTechnicianId);
      } else {
        setNewProcessTechnicianId('');
      }
    }
  };

  const handleConfirmAddProcess = () => {
    if (!newProcessId) {
      toast.error(t('workOrders.validation.selectProcess', 'Please select a process'));
      return;
    }
    const proc = availableProcesses.find((p) => p.id === newProcessId);
    if (!proc) return;

    const isExt = proc.type === 'EXTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('external');
    const isInt = proc.type === 'INTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('internal');
    const isVer = isExt || isInt || proc.name?.toLowerCase().includes('verif');
    const pType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' = isExt
      ? 'EXTERNAL_VERIFICATION'
      : isInt
      ? 'INTERNAL_VERIFICATION'
      : 'PRODUCTION';

    const newItem: ProcessFormItem = {
      tempId: `step-${Date.now()}`,
      processId: proc.id,
      processName: proc.name,
      processType: pType,
      technicianId: isExt ? undefined : (newProcessTechnicianId || undefined),
      doctorId: isExt ? (doctorId || undefined) : undefined,
      sequence: processList.length,
      isVerification: isVer,
      status: 'NOT_STARTED',
    };

    setProcessList((prev) => [...prev, newItem]);
    setNewProcessId('');
    setNewProcessTechnicianId('');
    setShowAddProcess(false);
  };

  // Payment Reference Numbers
  const handleAddReference = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = refInput.trim();
    if (!val) return;
    if (paymentReferences.includes(val)) {
      toast.error(t('workOrders.paymentRefExists', 'Reference already added'));
      return;
    }
    setPaymentReferences((prev) => [...prev, val]);
    setRefInput('');
  };

  const handleRemoveReference = (ref: string) => {
    setPaymentReferences((prev) => prev.filter((r) => r !== ref));
  };

  // Submission handler
  const handleSubmit = async (action: 'create' | 'createAndAssign') => {
    if (!validateTab1()) {
      setActiveTab(1);
      return;
    }

    if (processList.length === 0) {
      toast.error(t('workOrders.validation.atLeastOneProcess', 'At least one process step is required'));
      setActiveTab(2);
      return;
    }

    if (action === 'createAndAssign') {
      setShowConfirmAssignModal(true);
      return;
    }

    await executeCreate('create');
  };

  const executeCreate = async (action: 'create' | 'createAndAssign') => {
    setSubmitting(true);
    setSubmittingAction(action);

    try {
      const payload: CreateWorkOrderPayload = {
        doctorId,
        patient: patient.trim() || undefined,
        fileNumber: fileNumber.trim() || undefined,
        boxNumber: boxNumber.trim() || undefined,
        deliveryDate: deliveryDate || undefined,
        prosthesisTypeId,
        specification: specification.trim(),
        color: color.trim(),
        notes: notes.trim() || undefined,
        branchId: branchId || undefined,
        totalQuote: totalQuote !== '' && !isNaN(Number(totalQuote)) ? Number(totalQuote) : 0,
        initialPayment: parseFloat(initialPayment) || 0,
        paymentReferenceNumbers: paymentReferences,
        action,
        processes: processList.map((p, idx) => ({
          processName: p.processName,
          processId: p.processId,
          processType: p.processType,
          technicianId: p.processType === 'EXTERNAL_VERIFICATION' ? undefined : (p.technicianId || undefined),
          doctorId: p.processType === 'EXTERNAL_VERIFICATION' ? (doctorId || undefined) : undefined,
          sequence: idx,
          isVerification: p.isVerification,
          status: 'NOT_STARTED',
        })),
      };

      const result = await workOrderService.create(payload);
      toast.success(
        action === 'createAndAssign'
          ? t('workOrders.alerts.createAndAssignSuccess', { folio: result.folioNumber })
          : t('workOrders.alerts.createSuccess', { folio: result.folioNumber }),
      );
      setShowConfirmAssignModal(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create work order', err);
      const msg = err?.response?.data?.message || t('workOrders.alerts.createFailed', 'Failed to create work order');
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  };

  // Options for Doctor Select
  const doctorOptions = useMemo(() => {
    return doctors.map((d) => ({
      value: d.id,
      label: d.clinicName ? `${d.name} (${d.clinicName})` : d.name,
      badge: d.type === 'LOCAL' ? t('labDoctors.typeLocal') : t('labDoctors.typeIntegrated'),
    }));
  }, [doctors, t]);

  // Options for Prosthesis Select
  const prosthesisOptions = useMemo(() => {
    return prosthesisTypes.map((pt) => ({
      value: pt.id,
      label: pt.name,
    }));
  }, [prosthesisTypes]);

  // Options for Production steps: All Technicians + All Lab Admins (with designation)
  const productionOptions = useMemo(() => {
    const list: Array<{ value: string; label: string; sublabel?: string }> = [];
    const seen = new Set<string>();

    technicians.forEach((tech) => {
      if (!seen.has(tech.id)) {
        seen.add(tech.id);
        const designation = tech.designation || t('workOrders.designations.technician', 'Technician');
        list.push({
          value: tech.id,
          label: `${tech.name} (${designation})`,
          sublabel: designation,
        });
      }
    });

    labAdmins.forEach((admin) => {
      if (!seen.has(admin.id)) {
        seen.add(admin.id);
        const designation = admin.designation || t('workOrders.designations.labAdmin', 'Lab Admin');
        list.push({
          value: admin.id,
          label: `${admin.name} (${designation})`,
          sublabel: designation,
        });
      }
    });

    return list;
  }, [technicians, labAdmins, t]);

  // Options for Internal Verification steps: All Lab Admins only (with designation)
  const internalVerificationOptions = useMemo(() => {
    return labAdmins.map((admin) => {
      const designation = admin.designation || t('workOrders.designations.labAdmin', 'Lab Admin');
      return {
        value: admin.id,
        label: `${admin.name} (${designation})`,
        sublabel: designation,
      };
    });
  }, [labAdmins, t]);

  // Options for Add Process: Display ALL processes, but verification processes are clearly notified with badges and icons
  const availableProcessOptions = useMemo(() => {
    return availableProcesses.map((proc) => {
      const isExt =
        proc.type === 'EXTERNAL_VERIFICATION' ||
        proc.name?.toLowerCase().includes('external');
      const isInt =
        proc.type === 'INTERNAL_VERIFICATION' ||
        proc.isVerification === true ||
        proc.name?.toLowerCase().includes('verif');

      let badge: string | undefined = undefined;
      let icon: React.ReactNode | undefined = undefined;

      if (isExt) {
        badge = t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification');
        icon = <ShieldCheck size={14} style={{ color: '#4f46e5', flexShrink: 0 }} />;
      } else if (isInt) {
        badge = t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification');
        icon = <ShieldCheck size={14} style={{ color: '#d97706', flexShrink: 0 }} />;
      }

      return {
        value: proc.id,
        label: proc.name,
        badge,
        icon,
      };
    });
  }, [availableProcesses, t]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1050 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '780px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px' }}>
              {t('workOrders.modal.newOrderTitle', 'New Work Order')}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {t('workOrders.modal.newOrderSubtitle', 'Create a new dental lab work order')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <button
            type="button"
            onClick={() => handleTabClick(1)}
            style={{
              padding: '14px 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              borderBottom: activeTab === 1 ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 1 ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.tabs.orderDetails', '1. Order Details')}
          </button>

          <button
            type="button"
            onClick={() => handleTabClick(2)}
            style={{
              padding: '14px 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              borderBottom: activeTab === 2 ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 2 ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.tabs.processSteps', '2. Process Steps')}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor:
                  activeTab === 2 ? 'rgba(37, 99, 235, 0.12)' : 'var(--badge-neutral-bg)',
                color: activeTab === 2 ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              {processList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick(3)}
            style={{
              padding: '14px 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              borderBottom: activeTab === 3 ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 3 ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.tabs.payments', '3. Payments')}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            minHeight: '440px',
            flex: 1,
          }}
        >
          {loadingRefs ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                gap: '12px',
              }}
            >
              <Loader2 className="spinner" size={32} style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('common.loading', 'Loading details...')}
              </span>
            </div>
          ) : (
            <>
              {/* ══════════════════════════════════════════════════════════════
                  TAB 1: ORDER DETAILS
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Row 1: Doctor * & Patient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.doctor', 'Doctor')}{' '}
                        <span style={{ color: 'var(--rose-500)' }}>*</span>
                      </label>
                      <SearchableSelect
                        options={doctorOptions}
                        value={doctorId}
                        onChange={(val) => {
                          setDoctorId(val);
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.doctorId;
                            return copy;
                          });
                        }}
                        placeholder={t('workOrders.form.selectDoctor', 'Select a doctor')}
                        searchPlaceholder={t('workOrders.form.searchDoctor', 'Search doctor or clinic...')}
                      />
                      {errors.doctorId && (
                        <p style={{ color: 'var(--rose-500)', fontSize: '12px', margin: '4px 0 0' }}>
                          {errors.doctorId}
                        </p>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.patient', 'Patient')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., John Doe"
                        value={patient}
                        onChange={(e) => setPatient(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Folio Number | File Number | Box Number | Delivery Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.folioNumber', 'Folio Number')}
                      </label>
                      <input
                        type="text"
                        readOnly
                        className="form-input"
                        value={folioPreview}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          fontWeight: 800,
                          fontStyle: 'italic',
                          color: 'var(--text-heading)',
                          cursor: 'default',
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.fileNumber', 'File Number')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., FILE-101"
                        value={fileNumber}
                        onChange={(e) => setFileNumber(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.boxNumber', 'Box Number')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., BOX-42"
                        value={boxNumber}
                        onChange={(e) => setBoxNumber(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.deliveryDate', 'Delivery Date')}
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 3: Prosthesis Type * */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.prosthesisType', 'Prosthesis Type')}{' '}
                      <span style={{ color: 'var(--rose-500)' }}>*</span>
                    </label>
                    <SearchableSelect
                      options={prosthesisOptions}
                      value={prosthesisTypeId}
                      onChange={handleProsthesisTypeChange}
                      placeholder={t('workOrders.form.selectProsthesis', 'Select prosthesis type')}
                      searchPlaceholder={t('workOrders.form.searchProsthesis', 'Search prosthesis types...')}
                    />
                    {errors.prosthesisTypeId && (
                      <p style={{ color: 'var(--rose-500)', fontSize: '12px', margin: '4px 0 0' }}>
                        {errors.prosthesisTypeId}
                      </p>
                    )}
                  </div>

                  {/* Row 4: Specification * */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.specification', 'Specification')}{' '}
                      <span style={{ color: 'var(--rose-500)' }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      className="form-input"
                      placeholder={t('workOrders.form.specificationPlaceholder', 'Color, shade, units, material details...')}
                      value={specification}
                      onChange={(e) => {
                        setSpecification(e.target.value);
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.specification;
                          return copy;
                        });
                      }}
                      style={{ resize: 'vertical' }}
                    />
                    {errors.specification && (
                      <p style={{ color: 'var(--rose-500)', fontSize: '12px', margin: '4px 0 0' }}>
                        {errors.specification}
                      </p>
                    )}
                  </div>

                  {/* Row 5: Color * */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.color', 'Color')}{' '}
                      <span style={{ color: 'var(--rose-500)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., A1, A2, B1..."
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.color;
                          return copy;
                        });
                      }}
                    />
                    {errors.color && (
                      <p style={{ color: 'var(--rose-500)', fontSize: '12px', margin: '4px 0 0' }}>
                        {errors.color}
                      </p>
                    )}
                  </div>

                  {/* Row 6: Notes (Saved to history) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.notes', 'Notes')}
                    </label>
                    <textarea
                      rows={2}
                      className="form-input"
                      placeholder={t('workOrders.form.notesPlaceholder', 'General instructions, notes for technicians...')}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 2: PROCESS STEPS
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '380px', paddingBottom: '160px' }}>
                  {/* Top bar with count & Add Process button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                        {t('workOrders.processAssignmentTitle', 'Process Steps Assignment')}
                      </h3>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(37, 99, 235, 0.12)',
                          color: 'var(--primary-600)',
                        }}
                      >
                        {processList.length}
                      </span>
                    </div>

                    {!showAddProcess && (
                      <button
                        type="button"
                        onClick={() => setShowAddProcess(true)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                        }}
                      >
                        <Plus size={14} />
                        <span>{t('workOrders.addProcessBtn', 'Add Process')}</span>
                      </button>
                    )}
                  </div>

                  {/* Process Steps Cards List */}
                  {processList.length === 0 ? (
                    <div
                      style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: '12px',
                        border: '1px dashed var(--border-color)',
                      }}
                    >
                      <Clock size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                        {t('workOrders.noProcesses', 'No process steps added yet')}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                        {t('workOrders.noProcessesDesc', 'Select a prosthesis type with a default recipe or click Add Process')}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {processList.map((step, idx) => {
                        const isExt = step.processType === 'EXTERNAL_VERIFICATION';
                        const isInt = step.processType === 'INTERNAL_VERIFICATION' || step.isVerification;
                        return (
                          <div
                            key={step.tempId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 14px',
                              backgroundColor: 'var(--bg-card)',
                              border: isExt
                                ? '1px solid rgba(99, 102, 241, 0.35)'
                                : isInt
                                ? '1px solid rgba(245, 158, 11, 0.35)'
                                : '1px solid var(--border-color)',
                              borderRadius: '10px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Sequence circle */}
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: isExt
                                  ? 'rgba(99, 102, 241, 0.15)'
                                  : isInt
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(37, 99, 235, 0.15)',
                                color: isExt
                                  ? '#4f46e5'
                                  : isInt
                                  ? '#d97706'
                                  : 'var(--primary-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </div>

                            {/* Process name & tags */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: 'var(--text-heading)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {step.processName}
                              </div>
                              {isExt ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#4f46e5',
                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    marginTop: '3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <ShieldCheck size={11} />
                                  <span>{t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification')}</span>
                                </span>
                              ) : isInt ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#d97706',
                                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    marginTop: '3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <ShieldCheck size={11} />
                                  <span>{t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification')}</span>
                                </span>
                              ) : null}
                            </div>

                            {/* Assignee selector */}
                            <div style={{ width: '210px', flexShrink: 0 }}>
                              {step.processType === 'EXTERNAL_VERIFICATION' ? (
                                <input
                                  type="text"
                                  readOnly
                                  className="form-input"
                                  value={selectedDoctor ? selectedDoctor.name : t('workOrders.assignedDoctor', 'Assigned Doctor')}
                                  style={{
                                    fontSize: '12px',
                                    backgroundColor: 'var(--bg-surface)',
                                    cursor: 'default',
                                    fontWeight: 600,
                                  }}
                                />
                              ) : step.processType === 'INTERNAL_VERIFICATION' ? (
                                <SearchableSelect
                                  options={internalVerificationOptions}
                                  value={step.technicianId || ''}
                                  onChange={(val) => updateProcessTechnician(idx, val)}
                                  placeholder={t('workOrders.selectAdmin', 'Select administrator...')}
                                  searchPlaceholder={t('workOrders.searchAdmin', 'Search admin...')}
                                  style={{ fontSize: '12px' }}
                                />
                              ) : (
                                <SearchableSelect
                                  options={productionOptions}
                                  value={step.technicianId || ''}
                                  onChange={(val) => updateProcessTechnician(idx, val)}
                                  placeholder={t('workOrders.selectTechnician', 'Select technician...')}
                                  searchPlaceholder={t('workOrders.searchTech', 'Search...')}
                                  style={{ fontSize: '12px' }}
                                />
                              )}
                            </div>

                            {/* Status display */}
                            <div
                              style={{
                                width: '110px',
                                flexShrink: 0,
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                backgroundColor: 'var(--bg-surface)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                textAlign: 'center',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              {t('workOrders.statusNotStarted', 'Not Started')}
                            </div>

                            {/* Action Buttons: Up, Down, Delete */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <Tooltip content={t('common.moveUp', 'Move Up')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  disabled={idx === 0}
                                  onClick={() => moveProcess(idx, 'up')}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-surface)',
                                    color: idx === 0 ? 'var(--text-disabled)' : 'var(--text-main)',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <ChevronUp size={14} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('common.moveDown', 'Move Down')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  disabled={idx === processList.length - 1}
                                  onClick={() => moveProcess(idx, 'down')}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-surface)',
                                    color:
                                      idx === processList.length - 1
                                        ? 'var(--text-disabled)'
                                        : 'var(--text-main)',
                                    cursor:
                                      idx === processList.length - 1 ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('common.delete', 'Delete')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => removeProcess(idx)}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-surface)',
                                    color: 'var(--rose-500)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Add Process Card (Matches Screenshot 4) */}
                  {showAddProcess && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1.2fr auto auto',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        marginTop: '4px',
                      }}
                    >
                      <div>
                        <SearchableSelect
                          options={availableProcessOptions}
                          value={newProcessId}
                          onChange={handleSelectNewProcess}
                          placeholder={t('workOrders.form.selectProcess', 'Select process...')}
                          searchPlaceholder={t('workOrders.form.searchProcess', 'Search processes...')}
                        />
                      </div>

                      <div>
                        {(() => {
                          const selectedProc = availableProcesses.find((p) => p.id === newProcessId);
                          const isExt = selectedProc?.type === 'EXTERNAL_VERIFICATION' || selectedProc?.name?.toLowerCase().includes('external');
                          const isInt = selectedProc?.type === 'INTERNAL_VERIFICATION' || selectedProc?.name?.toLowerCase().includes('internal');

                          if (isExt) {
                            return (
                              <input
                                type="text"
                                readOnly
                                className="form-input"
                                value={selectedDoctor ? selectedDoctor.name : t('workOrders.assignedDoctor', 'Assigned Doctor')}
                                style={{ backgroundColor: 'var(--bg-card)', cursor: 'default', fontWeight: 600, fontSize: '12px' }}
                              />
                            );
                          }
                          if (isInt) {
                            return (
                              <SearchableSelect
                                options={internalVerificationOptions}
                                value={newProcessTechnicianId}
                                onChange={(val) => setNewProcessTechnicianId(val)}
                                placeholder={t('workOrders.selectAdmin', 'Select administrator...')}
                                searchPlaceholder={t('workOrders.searchAdmin', 'Search admin...')}
                                style={{ fontSize: '12px' }}
                              />
                            );
                          }
                          return (
                            <SearchableSelect
                              options={productionOptions}
                              value={newProcessTechnicianId}
                              onChange={(val) => setNewProcessTechnicianId(val)}
                              placeholder={t('workOrders.selectTechnician', 'Select technician...')}
                              searchPlaceholder={t('workOrders.searchTech', 'Search technician...')}
                              style={{ fontSize: '12px' }}
                            />
                          );
                        })()}
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmAddProcess}
                        className="btn btn-primary btn-sm"
                        style={{ height: '38px', padding: '0 16px', fontWeight: 700 }}
                      >
                        {t('common.add', 'Add')}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddProcess(false);
                          setNewProcessId('');
                          setNewProcessTechnicianId('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ height: '38px', padding: '0 14px' }}
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 3: PAYMENTS
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Row 1: Total Quote & Initial Payment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.totalQuote', 'Total Quote ($)')}{' '}
                        <span style={{ color: 'var(--rose-500)' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        placeholder="0"
                        value={totalQuote}
                        onChange={(e) => setTotalQuote(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.initialPayment', 'Initial Payment ($)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        placeholder="0"
                        value={initialPayment}
                        onChange={(e) => setInitialPayment(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Payment Reference Numbers */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.paymentRefTitle', 'Payment Reference Numbers')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('workOrders.form.paymentRefPlaceholder', 'Type reference number and click Add (e.g., REF-98765)')}
                        value={refInput}
                        onChange={(e) => setRefInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddReference();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddReference()}
                        className="btn btn-secondary"
                        style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
                      >
                        {t('workOrders.form.addReferenceBtn', 'Add Reference')}
                      </button>
                    </div>

                    {/* Tag list */}
                    {paymentReferences.length === 0 ? (
                      <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        {t('workOrders.form.noReferencesAdded', 'No reference numbers added')}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {paymentReferences.map((ref) => (
                          <span
                            key={ref}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--text-main)',
                            }}
                          >
                            <span>{ref}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveReference(ref)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                              }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          {activeTab > 1 ? (
            <button
              type="button"
              onClick={() => setActiveTab((prev) => (prev > 1 ? ((prev - 1) as 1 | 2) : 1))}
              className="btn btn-secondary"
              disabled={submitting}
              style={{ fontWeight: 600 }}
            >
              {t('common.back', 'Back')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
              style={{ fontWeight: 600 }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit('create')}
            className="btn btn-secondary"
            disabled={submitting}
            style={{ fontWeight: 700, minWidth: '90px' }}
          >
            {submitting && submittingAction === 'create' ? (
              <Loader2 size={16} className="spinner" />
            ) : (
              t('common.save', 'Save')
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('createAndAssign')}
            className="btn btn-primary"
            disabled={submitting}
            style={{ fontWeight: 700, minWidth: '130px' }}
          >
            {submitting && submittingAction === 'createAndAssign' ? (
              <Loader2 size={16} className="spinner" />
            ) : (
              t('workOrders.saveAndAssignBtn', 'Save & Assign')
            )}
          </button>
        </div>
      </div>

      {/* Confirm Assignment Modal (Matches Screenshot 3) */}
      {showConfirmAssignModal && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 1100,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '460px',
              width: '92%',
              padding: 0,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                    {t('workOrders.confirmAssignment.title', 'Confirm Assignment')}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {t('workOrders.confirmAssignment.subtitle', 'Activate workflow and lock structure')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setShowConfirmAssignModal(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 18px', lineHeight: 1.5, fontWeight: 500 }}>
                {t('workOrders.confirmAssignment.message', 'Are you sure you want to assign these processes and activate this Work Order?')}
              </p>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 800, color: '#d97706', marginRight: '4px' }}>
                  {t('workOrders.confirmAssignment.warningTitle', 'Warning:')}
                </span>
                {t(
                  'workOrders.confirmAssignment.warningText',
                  'Activating this Work Order locks the process sequence structure. You will not be able to add, delete, or reorder steps afterwards. The first technician in the sequence will receive an instant notification.',
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '14px 24px',
                backgroundColor: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmAssignModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontWeight: 600, fontSize: '13px' }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => executeCreate('createAndAssign')}
                className="btn btn-primary"
                style={{
                  padding: '8px 20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                }}
              >
                {submitting && submittingAction === 'createAndAssign' ? (
                  <>
                    <Loader2 size={15} className="spinner" />
                    <span>{t('common.loading', 'Loading...')}</span>
                  </>
                ) : (
                  <span>{t('workOrders.confirmAssignment.confirmBtn', 'Confirm & Activate')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
