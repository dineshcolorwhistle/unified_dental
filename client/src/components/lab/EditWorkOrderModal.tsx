import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  Clock,
  Loader2,
  ShieldCheck,
  MessageSquare,
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { Tooltip } from '../common/Tooltip';
import api from '../../services/api';
import {
  workOrderService,
  WorkOrderListItem,
  WorkOrderNoteItem,
  UpdateWorkOrderPayload,
} from '../../services/workOrderService';
import { doctorService, DoctorListItem } from '../../services/doctor.service';
import { formatDateTime } from '../../core/utils/dateUtils';

export interface ProcessEditItem {
  id?: string;
  tempId: string;
  processId?: string;
  processName: string;
  processType: 'PRODUCTION' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION';
  technicianId?: string;
  doctorId?: string;
  sequence: number;
  isVerification: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

interface EditWorkOrderModalProps {
  workOrder: WorkOrderListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditWorkOrderModal: React.FC<EditWorkOrderModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const isAdmin = Boolean(isTenantAdmin || isLabAdmin || user?.isSuperAdmin);

  // Active Tab: 1 (Order Details), 2 (Process Steps), 3 (Payments)
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);

  // Fresh data & Reference data
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string; designation?: string }>>([]);
  const [labAdmins, setLabAdmins] = useState<Array<{ id: string; name: string; designation?: string }>>([]);
  const [availableProcesses, setAvailableProcesses] = useState<any[]>([]);

  // Tab 1: Order Details
  const [doctorId, setDoctorId] = useState('');
  const [patient, setPatient] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [prosthesisTypeId, setProsthesisTypeId] = useState('');
  const [specification, setSpecification] = useState('');
  const [color, setColor] = useState('');

  // Tab 1: Notes History & Add Note Accordion
  const [notesList, setNotesList] = useState<WorkOrderNoteItem[]>([]);
  const [isNotesAccordionOpen, setIsNotesAccordionOpen] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<WorkOrderNoteItem | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  // Tab 2: Process Steps
  const [processList, setProcessList] = useState<ProcessEditItem[]>([]);
  const [showAddProcess, setShowAddProcess] = useState(false);
  const [newProcessId, setNewProcessId] = useState('');
  const [newProcessTechnicianId, setNewProcessTechnicianId] = useState('');

  // Tab 3: Payments
  const [totalQuote, setTotalQuote] = useState('0');
  const [initialPayment, setInitialPayment] = useState('0');
  const [paymentReferences, setPaymentReferences] = useState<string[]>([]);
  const [refInput, setRefInput] = useState('');

  // Refs for scrolling to Add Process card
  const addProcessCardRef = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Submission & Confirmation modal
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'save' | 'saveAndAssign' | null>(null);
  const [showConfirmAssignModal, setShowConfirmAssignModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch fresh Work Order data and reference data when modal opens
  useEffect(() => {
    if (isOpen && workOrder) {
      setActiveTab(1);
      setErrors({});
      setShowAddProcess(false);
      setNewProcessId('');
      setNewProcessTechnicianId('');
      setNewNoteText('');
      loadInitialData(workOrder);
    }
  }, [isOpen, workOrder?.id]);

  const loadInitialData = async (wo: WorkOrderListItem) => {
    // Populate immediately with provided workOrder prop
    populateForm(wo);

    try {
      setLoadingFresh(true);
      const [freshWo, doctorsRes, ptRes, techRes, adminRes, procRes] = await Promise.all([
        workOrderService.getById(wo.id).catch(() => wo),
        doctorService.getAll({ branchId: wo.branchId || undefined }).catch(() => []),
        api.get('/lab/prosthesis-types', { params: wo.branchId ? { branchId: wo.branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/users/technicians', { params: wo.branchId ? { branchId: wo.branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/users/admin', { params: wo.branchId ? { branchId: wo.branchId } : undefined }).catch(() => ({ data: [] })),
        api.get('/lab/processes', { params: wo.branchId ? { branchId: wo.branchId } : undefined }).catch(() => ({ data: [] })),
      ]);

      populateForm(freshWo);

      const activeDocs = Array.isArray(doctorsRes) ? doctorsRes.filter((d) => d.isActive) : [];
      setDoctors(activeDocs);

      const rawPt = Array.isArray(ptRes.data) ? ptRes.data : (ptRes.data as any)?.data || [];
      setProsthesisTypes(rawPt);

      const rawTechs = Array.isArray(techRes.data) ? techRes.data : (techRes.data as any)?.data || [];
      setTechnicians(
        rawTechs.map((tech: any) => ({
          id: tech.user?.id || tech.id,
          name: tech.user?.name || tech.name || 'Technician',
          designation: tech.roles?.[0] || tech.role || tech.designation || undefined,
        }))
      );

      const rawAdmins = Array.isArray(adminRes.data) ? adminRes.data : (adminRes.data as any)?.data || [];
      setLabAdmins(
        rawAdmins.map((admin: any) => ({
          id: admin.user?.id || admin.id,
          name: admin.user?.name || admin.name || 'Lab Admin',
          designation: admin.role || admin.roles?.[0] || admin.designation || undefined,
        }))
      );

      const rawProcs = Array.isArray(procRes.data) ? procRes.data : (procRes.data as any)?.data || [];
      setAvailableProcesses(rawProcs);
    } catch (err) {
      console.error('Failed to load work order details or references', err);
    } finally {
      setLoadingFresh(false);
    }
  };

  const populateForm = (wo: WorkOrderListItem) => {
    setDoctorId(wo.doctorId || '');
    setPatient(wo.patient || '');
    setFileNumber(wo.fileNumber || '');
    setBoxNumber(wo.boxNumber || '');
    setDeliveryDate(wo.deliveryDate ? wo.deliveryDate.split('T')[0] : '');
    setProsthesisTypeId(wo.prosthesisTypeId || '');
    setSpecification(wo.specification || '');
    setColor(wo.color || '');

    setTotalQuote(
      wo.totalQuote !== null && wo.totalQuote !== undefined ? String(wo.totalQuote) : '0'
    );
    setInitialPayment(
      wo.initialPayment !== null && wo.initialPayment !== undefined ? String(wo.initialPayment) : '0'
    );
    setPaymentReferences(Array.isArray(wo.paymentReferenceNumbers) ? [...wo.paymentReferenceNumbers] : []);

    // Notes
    setNotesList((wo.notesHistory as WorkOrderNoteItem[]) || []);

    // Processes
    if (Array.isArray(wo.processes)) {
      const mapped: ProcessEditItem[] = wo.processes.map((p: any, idx: number) => ({
        id: p.id,
        tempId: p.id || `proc-${idx}-${Date.now()}`,
        processId: p.processId || undefined,
        processName: p.processName || '',
        processType: p.processType || 'PRODUCTION',
        technicianId: p.technicianId || undefined,
        doctorId: p.doctorId || undefined,
        sequence: p.sequence !== undefined ? p.sequence : idx,
        isVerification: Boolean(p.isVerification),
        status: p.status || 'NOT_STARTED',
      }));
      mapped.sort((a, b) => a.sequence - b.sequence);
      setProcessList(mapped);
    } else {
      setProcessList([]);
    }
  };

  if (!isOpen || !workOrder) return null;

  // Balance calculation
  const totalQuoteNum = parseFloat(totalQuote) || 0;
  const initialPaymentNum = parseFloat(initialPayment) || 0;
  const balanceDue = Math.max(0, totalQuoteNum - initialPaymentNum);

  // Options
  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: d.clinicName ? `${d.name} (${d.clinicName})` : d.name,
    badge: d.type === 'LOCAL' ? t('labDoctors.typeLocal', 'Local') : t('labDoctors.typeIntegrated', 'Integrated'),
  }));

  const prosthesisTypeOptions = prosthesisTypes.map((pt) => ({
    value: pt.id,
    label: pt.name,
    description: pt.price ? `$${Number(pt.price).toFixed(2)}` : undefined,
  }));

  // Options for Production steps: All Technicians + All Lab Admins (with designation)
  const productionOptions = (() => {
    const list: Array<{ value: string; label: string; description?: string; badge?: string }> = [];
    const seen = new Set<string>();

    technicians.forEach((tech) => {
      if (!seen.has(tech.id)) {
        seen.add(tech.id);
        const designation = tech.designation || t('workOrders.designations.technician', 'Technician');
        list.push({
          value: tech.id,
          label: `${tech.name} (${designation})`,
          description: designation,
          badge: t('labUsers.technician', 'Technician'),
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
          description: designation,
          badge: t('labUsers.labAdmin', 'Lab Admin'),
        });
      }
    });

    return list;
  })();

  // Options for Internal Verification steps: All Lab Admins only (with designation)
  const internalVerificationOptions = labAdmins.map((admin) => {
    const designation = admin.designation || t('workOrders.designations.labAdmin', 'Lab Admin');
    return {
      value: admin.id,
      label: `${admin.name} (${designation})`,
      description: designation,
      badge: t('labUsers.labAdmin', 'Lab Admin'),
    };
  });

  // Combined options (Technicians + Lab Admins) for initial Add Step state
  const allAssigneeOptions = productionOptions;

  const availableProcessOptions = availableProcesses.map((p) => ({
    value: p.id,
    label: p.name,
    badge:
      p.type === 'EXTERNAL_VERIFICATION'
        ? t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification')
        : p.type === 'INTERNAL_VERIFICATION'
        ? t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification')
        : t('labProcesses.types.PRODUCTION', 'Production'),
  }));

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  // Tab validation
  const validateTab1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!doctorId) errs.doctorId = t('workOrders.validation.doctorRequired', 'Doctor is required');
    if (!prosthesisTypeId) errs.prosthesisTypeId = t('workOrders.validation.prosthesisRequired', 'Prosthesis type is required');
    if (!specification.trim()) errs.specification = t('workOrders.validation.specRequired', 'Clinical specification is required');
    if (!color.trim()) errs.color = t('workOrders.validation.colorRequired', 'Color / shade is required');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Process steps mutations
  const updateProcessTechnician = (index: number, techId: string) => {
    setProcessList((prev) => {
      const copy = [...prev];
      if (!copy[index].status || copy[index].status === 'NOT_STARTED') {
        copy[index] = { ...copy[index], technicianId: techId || undefined };
      }
      return copy;
    });
  };

  const removeProcess = (index: number) => {
    const step = processList[index];
    if (step.status && step.status !== 'NOT_STARTED') {
      toast.error(t('workOrders.editModal.cannotDeleteStarted', 'Cannot delete a process that has already started'));
      return;
    }
    setProcessList((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.map((p, idx) => ({ ...p, sequence: idx }));
    });
  };

  const moveProcess = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= processList.length) return;

    // Both steps should be NOT_STARTED to reorder
    if (
      (processList[index].status && processList[index].status !== 'NOT_STARTED') ||
      (processList[targetIdx].status && processList[targetIdx].status !== 'NOT_STARTED')
    ) {
      toast.error(t('workOrders.editModal.cannotReorderStarted', 'Cannot reorder steps that have already started'));
      return;
    }

    setProcessList((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((p, idx) => ({ ...p, sequence: idx }));
    });
  };

  const handleOpenAddProcess = () => {
    setShowAddProcess(true);
    setTimeout(() => {
      addProcessCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
  };

  const handleSelectNewProcess = (procId: string) => {
    setNewProcessId(procId);
    if (!procId) {
      setNewProcessTechnicianId('');
      return;
    }

    const proc = availableProcesses.find((p) => p.id === procId);
    if (!proc) return;

    const isExt = proc.type === 'EXTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('external');
    const isInt = proc.type === 'INTERNAL_VERIFICATION' || proc.name?.toLowerCase().includes('internal');

    if (isExt) {
      setNewProcessTechnicianId('');
    } else if (isInt) {
      if (proc.defaultTechnicianId && labAdmins.some((a) => a.id === proc.defaultTechnicianId)) {
        setNewProcessTechnicianId(proc.defaultTechnicianId);
      } else if (labAdmins.length > 0) {
        setNewProcessTechnicianId(labAdmins[0].id);
      } else {
        setNewProcessTechnicianId('');
      }
    } else {
      if (
        proc.defaultTechnicianId &&
        (technicians.some((t) => t.id === proc.defaultTechnicianId) ||
          labAdmins.some((a) => a.id === proc.defaultTechnicianId))
      ) {
        setNewProcessTechnicianId(proc.defaultTechnicianId);
      } else {
        setNewProcessTechnicianId('');
      }
    }
  };

  const handleAddProcess = () => {
    if (!newProcessId) {
      toast.error(t('workOrders.validation.selectProcessToAdd', 'Please select a process to add'));
      return;
    }

    const template = availableProcesses.find((p) => p.id === newProcessId);
    if (!template) return;

    const isExt = template.type === 'EXTERNAL_VERIFICATION' || template.name?.toLowerCase().includes('external');
    const isInt = template.type === 'INTERNAL_VERIFICATION' || template.name?.toLowerCase().includes('internal');

    const newItem: ProcessEditItem = {
      tempId: `new-${Date.now()}`,
      processId: template.id,
      processName: template.name,
      processType: isExt ? 'EXTERNAL_VERIFICATION' : isInt ? 'INTERNAL_VERIFICATION' : 'PRODUCTION',
      technicianId: isExt ? undefined : (newProcessTechnicianId || undefined),
      doctorId: isExt ? (doctorId || undefined) : undefined,
      sequence: processList.length,
      isVerification: isExt || isInt,
      status: 'NOT_STARTED',
    };

    setProcessList((prev) => [...prev, newItem]);
    setNewProcessId('');
    setNewProcessTechnicianId('');
    setShowAddProcess(false);
    setTimeout(() => {
      modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
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

  // Note posting in Accordion
  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNoteText.trim();
    if (!text) return;

    setAddingNote(true);
    try {
      const created = await workOrderService.addNote(workOrder.id, text);
      setNotesList((prev) => [created, ...prev]);
      setNewNoteText('');
      toast.success(t('workOrders.editModal.addNoteSuccess', 'Note added successfully.'));
    } catch (err: any) {
      console.error('Failed to add note', err);
      toast.error(err?.response?.data?.message || t('workOrders.editModal.addNoteFailed', 'Failed to add note.'));
    } finally {
      setAddingNote(false);
    }
  };

  // Note editing & deleting handlers
  const handleStartEditNote = (item: WorkOrderNoteItem) => {
    setEditingNoteId(item.id);
    setEditingNoteText(item.note);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleSaveEditNote = async (noteId: string) => {
    const text = editingNoteText.trim();
    if (!text) return;

    setSavingNoteId(noteId);
    try {
      const updated = await workOrderService.updateNote(workOrder.id, noteId, text);
      setNotesList((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, note: updated.note } : n))
      );
      setEditingNoteId(null);
      setEditingNoteText('');
      toast.success(t('workOrders.editModal.updateNoteSuccess', 'Note updated successfully.'));
    } catch (err: any) {
      console.error('Failed to update note', err);
      toast.error(err?.response?.data?.message || t('workOrders.editModal.updateNoteFailed', 'Failed to update note.'));
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete) return;
    setDeletingNote(true);
    try {
      await workOrderService.deleteNote(workOrder.id, noteToDelete.id);
      setNotesList((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setNoteToDelete(null);
      toast.success(t('workOrders.editModal.deleteNoteSuccess', 'Note deleted successfully.'));
    } catch (err: any) {
      console.error('Failed to delete note', err);
      toast.error(err?.response?.data?.message || t('workOrders.editModal.deleteNoteFailed', 'Failed to delete note.'));
    } finally {
      setDeletingNote(false);
    }
  };

  // Submission handler
  const handleSubmit = async (action: 'save' | 'saveAndAssign') => {
    if (!validateTab1()) {
      setActiveTab(1);
      return;
    }

    if (processList.length === 0) {
      toast.error(t('workOrders.validation.atLeastOneProcess', 'At least one process step is required'));
      setActiveTab(2);
      return;
    }

    if (action === 'saveAndAssign') {
      setShowConfirmAssignModal(true);
      return;
    }

    await executeSubmit('save');
  };

  const executeSubmit = async (action: 'save' | 'saveAndAssign') => {
    setSubmitting(true);
    setSubmittingAction(action);

    try {
      const payload: UpdateWorkOrderPayload = {
        doctorId,
        patient: patient.trim() || undefined,
        fileNumber: fileNumber.trim() || undefined,
        boxNumber: boxNumber.trim() || undefined,
        deliveryDate: deliveryDate || undefined,
        prosthesisTypeId,
        specification: specification.trim(),
        color: color.trim(),
        totalQuote: totalQuote !== '' && !isNaN(Number(totalQuote)) ? Number(totalQuote) : 0,
        initialPayment: parseFloat(initialPayment) || 0,
        paymentReferenceNumbers: paymentReferences,
        action,
        processes: processList.map((p, idx) => ({
          id: p.id,
          processName: p.processName,
          processId: p.processId,
          processType: p.processType,
          technicianId: p.processType === 'EXTERNAL_VERIFICATION' ? undefined : (p.technicianId || undefined),
          doctorId: p.processType === 'EXTERNAL_VERIFICATION' ? (doctorId || undefined) : undefined,
          sequence: idx,
          isVerification: p.isVerification,
          status: p.status,
        })),
      };

      await workOrderService.update(workOrder.id, payload);
      toast.success(
        action === 'saveAndAssign'
          ? t('workOrders.editModal.updateAndAssignSuccess', { folio: workOrder.folioNumber })
          : t('workOrders.editModal.updateSuccess', { folio: workOrder.folioNumber })
      );
      setShowConfirmAssignModal(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update work order', err);
      const msg = err?.response?.data?.message || t('workOrders.editModal.updateFailed', 'Failed to update work order.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  };

  // Helper for Status Badge in Tab 2
  const renderStatusBadge = (status: string) => {
    let bg = 'var(--bg-surface)';
    let color = 'var(--text-muted)';
    let borderColor = 'var(--border-color)';

    switch (status) {
      case 'IN_PROGRESS':
        bg = 'rgba(37, 99, 235, 0.1)';
        color = 'var(--primary-600)';
        borderColor = 'rgba(37, 99, 235, 0.3)';
        break;
      case 'PAUSED':
        bg = 'rgba(245, 158, 11, 0.1)';
        color = '#d97706';
        borderColor = 'rgba(245, 158, 11, 0.3)';
        break;
      case 'COMPLETED':
        bg = 'rgba(16, 185, 129, 0.1)';
        color = '#10b981';
        borderColor = 'rgba(16, 185, 129, 0.3)';
        break;
      case 'FAILED':
        bg = 'rgba(239, 68, 68, 0.1)';
        color = 'var(--rose-500)';
        borderColor = 'rgba(239, 68, 68, 0.3)';
        break;
      case 'NOT_STARTED':
      default:
        bg = 'var(--bg-surface)';
        color = 'var(--text-muted)';
        borderColor = 'var(--border-color)';
        break;
    }

    return (
      <div
        style={{
          width: '120px',
          flexShrink: 0,
          fontSize: '12px',
          fontWeight: 700,
          color,
          backgroundColor: bg,
          padding: '6px 10px',
          borderRadius: '8px',
          textAlign: 'center',
          border: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
        }}
      >
        <span>{t(`enums.processStatus.${status}`, status.replace('_', ' '))}</span>
      </div>
    );
  };

  const isCreatedStatus = workOrder?.status === 'CREATED';

  return (
    <div className="modal-overlay" style={{ zIndex: 1060 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* ─── MODAL HEADER ─── */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('workOrders.editModal.title', 'Edit Work Order')}
              </h2>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--primary-600)',
                }}
              >
                {workOrder.folioNumber}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {t(`enums.workOrderStatus.${workOrder.status}`, workOrder.status)}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              {t('workOrders.editModal.subtitle', 'Edit existing dental lab work order details')}
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

        {/* ─── TAB NAVIGATION (Matching Screenshot) ─── */}
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
          {/* Tab 1 */}
          <button
            type="button"
            onClick={() => setActiveTab(1)}
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

          {/* Tab 2 with Badge */}
          <button
            type="button"
            onClick={() => setActiveTab(2)}
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
                backgroundColor: activeTab === 2 ? 'rgba(37, 99, 235, 0.12)' : 'var(--badge-neutral-bg)',
                color: activeTab === 2 ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              {processList.length}
            </span>
          </button>

          {/* Tab 3 */}
          <button
            type="button"
            onClick={() => setActiveTab(3)}
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

        {/* ─── MODAL SCROLLABLE BODY ─── */}
        <div
          ref={modalBodyRef}
          className="modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            minHeight: '440px',
            flex: 1,
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {loadingFresh ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
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
                  TAB 1: ORDER DETAILS & NOTES ACCORDION
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Doctor & Patient */}
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

                  {/* File Number & Box Number */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.fileNumber', 'File Number')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., EXP-2026-004"
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
                        placeholder="e.g., BX-12"
                        value={boxNumber}
                        onChange={(e) => setBoxNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Delivery Date & Prosthesis Type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {t('workOrders.form.prosthesisType', 'Prosthesis Type')}{' '}
                        <span style={{ color: 'var(--rose-500)' }}>*</span>
                      </label>
                      <SearchableSelect
                        options={prosthesisTypeOptions}
                        value={prosthesisTypeId}
                        onChange={(val) => {
                          setProsthesisTypeId(val);
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.prosthesisTypeId;
                            return copy;
                          });
                        }}
                        placeholder={t('workOrders.form.selectProsthesisType', 'Select prosthesis type...')}
                        searchPlaceholder={t('workOrders.form.searchProsthesis', 'Search prosthesis type...')}
                      />
                      {errors.prosthesisTypeId && (
                        <p style={{ color: 'var(--rose-500)', fontSize: '12px', margin: '4px 0 0' }}>
                          {errors.prosthesisTypeId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Color / Shade */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.color', 'Color / Shade')}{' '}
                      <span style={{ color: 'var(--rose-500)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., A1, 2M2, Bleach"
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

                  {/* Clinical Specifications */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {t('workOrders.form.specification', 'Clinical Specification / Instructions')}{' '}
                      <span style={{ color: 'var(--rose-500)' }}>*</span>
                    </label>
                    <textarea
                      rows={2}
                      className="form-input"
                      placeholder="e.g., Translucent incisal edge, high polish finish..."
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

                  {/* ─── NOTES HISTORY ACCORDION (Requirement 5) ─── */}
                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      overflow: 'hidden',
                      marginTop: '6px',
                    }}
                  >
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => setIsNotesAccordionOpen((prev) => !prev)}
                      style={{
                        width: '100%',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        backgroundColor: 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            color: 'var(--primary-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MessageSquare size={16} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {t('workOrders.editModal.notesAccordionTitle', 'Notes & History')}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary-600)',
                          }}
                        >
                          {notesList.length}
                        </span>
                      </div>

                      <div style={{ color: 'var(--text-muted)' }}>
                        {isNotesAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    {/* Accordion Content */}
                    {isNotesAccordionOpen && (
                      <div
                        style={{
                          padding: '16px 18px',
                          borderTop: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          backgroundColor: 'var(--bg-card)',
                        }}
                      >
                        {/* Inline Add Note Form */}
                        <form onSubmit={handlePostNote} style={{ display: 'flex', gap: '10px' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={t('workOrders.editModal.newNotePlaceholder', 'Write a note or clinical update...')}
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            disabled={addingNote}
                            style={{ flex: 1, fontSize: '13px' }}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={addingNote || !newNoteText.trim()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                              padding: '8px 14px',
                            }}
                          >
                            {addingNote ? (
                              <Loader2 size={14} className="spinner" />
                            ) : (
                              <Send size={14} />
                            )}
                            <span>{t('workOrders.editModal.addNoteBtn', 'Post Note')}</span>
                          </button>
                        </form>

                        {/* Existing Notes Timeline */}
                        {notesList.length === 0 ? (
                          <p
                            style={{
                              fontSize: '12px',
                              fontStyle: 'italic',
                              color: 'var(--text-muted)',
                              textAlign: 'center',
                              margin: '8px 0',
                            }}
                          >
                            {t('workOrders.editModal.noNotesRecorded', 'No notes recorded yet for this work order.')}
                          </p>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              maxHeight: '220px',
                              overflowY: 'auto',
                              paddingRight: '4px',
                            }}
                          >
                            {notesList.map((item) => {
                              const isAuthor = item.userId === user?.id || (item.user && item.user.id === user?.id);
                              const canEditOrDelete = isAdmin || isAuthor;
                              const isEditing = editingNoteId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
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
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading)' }}>
                                        {item.user?.name || t('common.user', 'User')}
                                      </span>
                                      {isAuthor && (
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                            color: 'var(--primary-600)',
                                          }}
                                        >
                                          {t('common.you', 'You')}
                                        </span>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {formatDateTime(item.createdAt)}
                                      </span>

                                      {/* Role-based Edit & Delete (Admin can edit/delete all; Technician only own notes) */}
                                      {canEditOrDelete && !isEditing && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <Tooltip content={t('common.edit', 'Edit')}>
                                            <button
                                              type="button"
                                              className="btn-icon"
                                              onClick={() => handleStartEditNote(item)}
                                              style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--text-muted)',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.color = 'var(--primary-600)';
                                                e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                              }}
                                            >
                                              <Pencil size={12} />
                                            </button>
                                          </Tooltip>

                                          <Tooltip content={t('common.delete', 'Delete')}>
                                            <button
                                              type="button"
                                              className="btn-icon"
                                              onClick={() => setNoteToDelete(item)}
                                              style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--rose-500)',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                              }}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {isEditing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                                      <textarea
                                        rows={2}
                                        className="form-input"
                                        value={editingNoteText}
                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                        disabled={savingNoteId === item.id}
                                        style={{ fontSize: '12px', resize: 'vertical' }}
                                        autoFocus
                                      />
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={handleCancelEditNote}
                                          disabled={savingNoteId === item.id}
                                          style={{ padding: '4px 8px', fontSize: '11px' }}
                                        >
                                          <X size={12} />
                                          <span>{t('common.cancel', 'Cancel')}</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() => handleSaveEditNote(item.id)}
                                          disabled={savingNoteId === item.id || !editingNoteText.trim()}
                                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700 }}
                                        >
                                          {savingNoteId === item.id ? (
                                            <Loader2 size={12} className="spinner" />
                                          ) : (
                                            <CheckCircle2 size={12} />
                                          )}
                                          <span>{t('common.save', 'Save')}</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p
                                      style={{
                                        fontSize: '13px',
                                        color: 'var(--text-main)',
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {item.note}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 2: PROCESS STEPS (Matching Screenshot)
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Top Bar: Title & Count & Add Process Button */}
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
                        onClick={handleOpenAddProcess}
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

                  {/* Process Step Cards List (Rendered at top) */}
                  {processList.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 16px',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '12px',
                        border: '1px dashed var(--border-color)',
                      }}
                    >
                      <Clock size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 4px' }}>
                        {t('workOrders.noProcesses', 'No process steps added yet')}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {processList.map((step, idx) => {
                        const isExt = step.processType === 'EXTERNAL_VERIFICATION';
                        const isInt = step.processType === 'INTERNAL_VERIFICATION' || step.isVerification;
                        const isStarted = Boolean(step.status && step.status !== 'NOT_STARTED');

                        const currentAssigneeName =
                          technicians.find((t) => t.id === step.technicianId)?.name ||
                          labAdmins.find((a) => a.id === step.technicianId)?.name;

                        // Filter existing process assignee options based on process type:
                        // - Internal Verification: All Admins
                        // - Production: All Technicians and Admins
                        const stepAssigneeOptions = isInt
                          ? internalVerificationOptions.some((o) => o.value === step.technicianId)
                            ? internalVerificationOptions
                            : step.technicianId
                            ? [
                                ...internalVerificationOptions,
                                {
                                  value: step.technicianId,
                                  label: currentAssigneeName || step.technicianId,
                                  badge: t('labUsers.labAdmin', 'Lab Admin'),
                                },
                              ]
                            : internalVerificationOptions
                          : productionOptions.some((o) => o.value === step.technicianId)
                          ? productionOptions
                          : step.technicianId
                          ? [
                              ...productionOptions,
                              {
                                value: step.technicianId,
                                label: currentAssigneeName || step.technicianId,
                                badge: t('labUsers.technician', 'Technician'),
                              },
                            ]
                          : productionOptions;

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
                            {/* Sequence Circle */}
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

                            {/* Process Name & Badges */}
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

                            {/* Assignee Selector (Locked once started & Filtered by type) */}
                            <div style={{ width: '210px', flexShrink: 0 }}>
                              {isExt ? (
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
                              ) : isStarted ? (
                                <Tooltip content={t('workOrders.editModal.cannotChangeStartedTech', 'Assigned technician cannot be changed after process has started')}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '7px 10px',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--bg-surface)',
                                      border: '1px solid var(--border-color)',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: 'var(--text-main)',
                                      cursor: 'not-allowed',
                                    }}
                                  >
                                    <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {currentAssigneeName || t('common.unassigned', 'Unassigned')}
                                    </span>
                                  </div>
                                </Tooltip>
                              ) : isInt ? (
                                <SearchableSelect
                                  options={stepAssigneeOptions}
                                  value={step.technicianId || ''}
                                  onChange={(val) => updateProcessTechnician(idx, val)}
                                  placeholder={t('workOrders.selectAdmin', 'Select administrator...')}
                                  searchPlaceholder={t('workOrders.searchAdmin', 'Search admin...')}
                                  style={{ fontSize: '12px' }}
                                />
                              ) : (
                                <SearchableSelect
                                  options={stepAssigneeOptions}
                                  value={step.technicianId || ''}
                                  onChange={(val) => updateProcessTechnician(idx, val)}
                                  placeholder={t('workOrders.form.selectTechnicianOrAdmin', 'Select technician or admin...')}
                                  searchPlaceholder={t('workOrders.form.searchTechOrAdmin', 'Search technician or admin...')}
                                  style={{ fontSize: '12px' }}
                                />
                              )}
                            </div>

                            {/* Process Current Status (Requirement 2) */}
                            {renderStatusBadge(step.status)}

                            {/* Action Buttons: Up, Down, Delete */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <Tooltip content={t('common.moveUp', 'Move Up')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  disabled={idx === 0 || isStarted}
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
                                    color: idx === 0 || isStarted ? 'var(--text-disabled)' : 'var(--text-main)',
                                    cursor: idx === 0 || isStarted ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <ChevronUp size={14} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('common.moveDown', 'Move Down')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  disabled={idx === processList.length - 1 || isStarted}
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
                                      idx === processList.length - 1 || isStarted
                                        ? 'var(--text-disabled)'
                                        : 'var(--text-main)',
                                    cursor: idx === processList.length - 1 || isStarted ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </Tooltip>

                              {/* Delete Button (Locked once started) */}
                              {isStarted ? (
                                <Tooltip content={t('workOrders.editModal.cannotDeleteStarted', 'Cannot delete a process that has already started')}>
                                  <button
                                    type="button"
                                    disabled
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-surface)',
                                      color: 'var(--text-disabled)',
                                      cursor: 'not-allowed',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </Tooltip>
                              ) : (
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
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ─── ADD PROCESS AT THE END OF THE LIST (Requirements 1 & 2) ─── */}
                  {showAddProcess && (
                    <div
                      ref={addProcessCardRef}
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        marginTop: '4px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                            {t('workOrders.selectProcess', 'Select Process')}
                          </label>
                          <SearchableSelect
                            options={availableProcessOptions}
                            value={newProcessId}
                            onChange={handleSelectNewProcess}
                            placeholder={t('workOrders.chooseProcessPlaceholder', 'Choose process...')}
                            searchPlaceholder={t('workOrders.searchProcesses', 'Search processes...')}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                            {t('workOrders.assignTechnician', 'Assign Technician / Admin')}
                          </label>
                          {(() => {
                            const selectedProc = availableProcesses.find((p) => p.id === newProcessId);
                            const isExt =
                              selectedProc?.type === 'EXTERNAL_VERIFICATION' ||
                              selectedProc?.name?.toLowerCase().includes('external');
                            const isInt =
                              selectedProc?.type === 'INTERNAL_VERIFICATION' ||
                              selectedProc?.name?.toLowerCase().includes('internal');

                            if (isExt) {
                              return (
                                <input
                                  type="text"
                                  readOnly
                                  className="form-input"
                                  value={selectedDoctor ? selectedDoctor.name : t('workOrders.assignedDoctor', 'Assigned Doctor')}
                                  style={{
                                    backgroundColor: 'var(--bg-surface)',
                                    cursor: 'default',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                  }}
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

                            if (selectedProc?.type === 'PRODUCTION') {
                              return (
                                <SearchableSelect
                                  options={productionOptions}
                                  value={newProcessTechnicianId}
                                  onChange={(val) => setNewProcessTechnicianId(val)}
                                  placeholder={t('workOrders.form.selectTechnicianOrAdmin', 'Select technician or admin...')}
                                  searchPlaceholder={t('workOrders.form.searchTechOrAdmin', 'Search technician or admin...')}
                                  style={{ fontSize: '12px' }}
                                />
                              );
                            }

                            // Initially before a process is selected: display all technicians and admins (Requirement 2)
                            return (
                              <SearchableSelect
                                options={allAssigneeOptions}
                                value={newProcessTechnicianId}
                                onChange={(val) => setNewProcessTechnicianId(val)}
                                placeholder={t('workOrders.form.selectTechnicianOrAdmin', 'Select technician or admin...')}
                                searchPlaceholder={t('workOrders.form.searchTechOrAdmin', 'Search technician or admin...')}
                                style={{ fontSize: '12px' }}
                              />
                            );
                          })()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowAddProcess(false);
                            setNewProcessId('');
                            setNewProcessTechnicianId('');
                          }}
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAddProcess}
                          style={{ fontWeight: 700 }}
                        >
                          {t('workOrders.addStep', 'Add Step')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Bottom "+ Add Process" Button when list has items */}
                  {!showAddProcess && processList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenAddProcess}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'var(--bg-surface)',
                        width: '100%',
                        marginTop: '4px',
                      }}
                    >
                      <Plus size={15} />
                      <span>{t('workOrders.addProcessBtn', 'Add Process')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 3: PAYMENTS
              ══════════════════════════════════════════════════════════════ */}
              {activeTab === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Financial Summary Card */}
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                    }}
                  >
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 16px' }}>
                      {t('workOrders.viewModal.financials', 'Financial Summary')}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                          {t('workOrders.form.totalQuote', 'Total Quote')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          value={totalQuote}
                          onChange={(e) => setTotalQuote(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                          {t('workOrders.form.initialPayment', 'Initial Payment')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          value={initialPayment}
                          onChange={(e) => setInitialPayment(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                          {t('workOrders.form.balanceDue', 'Balance Due')}
                        </label>
                        <div
                          style={{
                            padding: '9px 12px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontWeight: 800,
                            color: balanceDue > 0 ? 'var(--rose-500)' : '#10b981',
                            fontSize: '14px',
                          }}
                        >
                          ${balanceDue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Reference Numbers */}
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                    }}
                  >
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px' }}>
                      {t('workOrders.form.paymentReferences', 'Payment Reference Numbers')}
                    </label>

                    <form onSubmit={handleAddReference} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. REC-9921, SPEI-002"
                        value={refInput}
                        onChange={(e) => setRefInput(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={!refInput.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      >
                        <Plus size={15} />
                        <span>{t('workOrders.form.addReference', 'Add')}</span>
                      </button>
                    </form>

                    {paymentReferences.length === 0 ? (
                      <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
                        {t('workOrders.form.noReferencesAdded', 'No reference numbers added')}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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

        {/* ─── MODAL FOOTER (Matching Requirements 4 & Screenshot) ─── */}
        <div
          className="modal-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Back Button (matching screenshot left side) */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (activeTab > 1) {
                setActiveTab((prev) => (prev - 1) as 1 | 2);
              } else {
                onClose();
              }
            }}
            disabled={submitting}
            style={{ fontWeight: 600, minWidth: '85px' }}
          >
            {activeTab > 1 ? t('workOrders.editModal.backBtn', 'Back') : t('common.cancel', 'Cancel')}
          </button>

          {/* Action Buttons (Save or Save & Save and Assign) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* If status is CREATED: show Save and Save & Assign */}
            {isCreatedStatus ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit('save')}
                  className="btn btn-secondary"
                  disabled={submitting}
                  style={{ fontWeight: 700, minWidth: '90px' }}
                >
                  {submitting && submittingAction === 'save' ? (
                    <Loader2 size={16} className="spinner" />
                  ) : (
                    t('workOrders.editModal.save', 'Save')
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit('saveAndAssign')}
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{
                    fontWeight: 700,
                    minWidth: '130px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submitting && submittingAction === 'saveAndAssign' ? (
                    <Loader2 size={16} className="spinner" />
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>{t('workOrders.editModal.saveAndAssign', 'Save & Assign')}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Except CREATED: only Save button available */
              <button
                type="button"
                onClick={() => handleSubmit('save')}
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  fontWeight: 700,
                  minWidth: '110px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {submitting ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <>
                    <Save size={16} />
                    <span>{t('workOrders.editModal.saveChanges', 'Save Changes')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── CONFIRM ASSIGNMENT MODAL ─── */}
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
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
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
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
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
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                {t(
                  'workOrders.confirmAssignment.message',
                  'Are you sure you want to assign these processes and activate this Work Order?'
                )}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  <strong style={{ color: '#d97706' }}>
                    {t('workOrders.confirmAssignment.warningTitle', 'Warning:')}{' '}
                  </strong>
                  {t(
                    'workOrders.confirmAssignment.warningText',
                    'Activating this Work Order locks the process sequence structure. The first technician in the sequence will receive an instant notification.'
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 24px',
                backgroundColor: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => setShowConfirmAssignModal(false)}
                style={{ fontWeight: 600 }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => executeSubmit('saveAndAssign')}
                style={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.saving', 'Saving...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{t('workOrders.confirmAssignment.confirmBtn', 'Confirm & Activate')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE NOTE CONFIRMATION MODAL ─── */}
      {noteToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1080 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--rose-500)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Trash2 size={22} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 6px' }}>
              {t('workOrders.editModal.deleteNoteConfirmTitle', 'Delete Note')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              {t(
                'workOrders.editModal.deleteNoteConfirmMsg',
                'Are you sure you want to delete this note? This action cannot be undone.'
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNoteToDelete(null)}
                disabled={deletingNote}
                style={{ fontWeight: 600 }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteNote}
                disabled={deletingNote}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {deletingNote ? <Loader2 size={14} className="spinner" /> : <Trash2 size={14} />}
                <span>{t('common.delete', 'Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
