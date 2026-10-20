import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ClipboardList,
  User,
  Stethoscope,
  Calendar,
  Layers,
  DollarSign,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Loader2,
  Tag,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  FileText,
  History,
  Check,
  RotateCcw,
  Play,
  Pause,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  WorkOrderListItem,
  workOrderService,
  WorkOrderNoteItem,
  WorkOrderPaymentItem,
  WorkOrderProcessItem,
} from '../../services/workOrderService';
import { paymentMethodService, PaymentMethodItem } from '../../services/paymentMethodService';
import { formatDate, formatDateTime, formatTime, formatCurrency } from '../../core/utils/dateUtils';
import { formatAuditLog, extractReworkCycles } from '../../core/utils/auditUtils';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { Tooltip } from '../common/Tooltip';
import { WorkOrderChatTab } from './WorkOrderChatTab';
import { EditWorkOrderModal } from './EditWorkOrderModal';
import { VerifyWorkOrderModal } from './VerifyWorkOrderModal';

export interface ViewWorkOrderModalProps {
  workOrder?: WorkOrderListItem | null;
  workOrderId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
  initialTab?: 'general' | 'processes' | 'reworks' | 'payments' | 'chat';
  onNavigateToEdit?: (workOrder: WorkOrderListItem) => void;
}

type TabKey = 'general' | 'processes' | 'reworks' | 'payments' | 'chat';

const TIMELINE_STAGES = [
  'CREATED',
  'ASSIGNED',
  'IN_PROGRESS',
  'INTERNAL_VERIFICATION',
  'EXTERNAL_VERIFICATION',
  'COMPLETED',
] as const;

export const ViewWorkOrderModal: React.FC<ViewWorkOrderModalProps> = ({
  workOrder: initialWorkOrder,
  workOrderId,
  isOpen,
  onClose,
  onOrderUpdated,
  initialTab,
  onNavigateToEdit,
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const isAdmin = Boolean(isTenantAdmin || isLabAdmin || user?.isSuperAdmin);
  const isTechnician = !isAdmin;
  const canEdit = isAdmin;
  const { socket } = useNotifications();

  const [currentWO, setCurrentWO] = useState<WorkOrderListItem | null>(initialWorkOrder || null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleNavigateToEdit = () => {
    if (!currentWO) return;
    if (onNavigateToEdit) {
      onNavigateToEdit(currentWO);
    } else {
      setIsEditModalOpen(true);
    }
  };

  const reworkCycles = useMemo(() => {
    return extractReworkCycles(currentWO);
  }, [currentWO]);
  const hasReworks =
    reworkCycles.length > 0 ||
    Boolean(
      currentWO?.processes &&
        currentWO.processes.some(
          (p: any) => (p.reworkCount && p.reworkCount > 0) || p.reworkActive,
        ),
    );

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (initialTab === 'reworks' && !hasReworks) return 'general';
    return initialTab || 'general';
  });

  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'reworks' && !hasReworks) {
        setActiveTab('general');
      } else {
        setActiveTab(initialTab || 'general');
      }
    }
  }, [isOpen, initialTab, hasReworks]);

  useEffect(() => {
    if (activeTab === 'reworks' && !hasReworks) {
      setActiveTab('general');
    }
  }, [activeTab, hasReworks]);

  // General tab: Notes state
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const [showAddNoteInput, setShowAddNoteInput] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState<WorkOrderNoteItem[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<WorkOrderNoteItem | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  // Processes tab state
  const [expandedAuditProcessId, setExpandedAuditProcessId] = useState<string | null>(null);
  const [actionLoadingProcessId, setActionLoadingProcessId] = useState<string | null>(null);
  const [verifyModalProcess, setVerifyModalProcess] = useState<{
    processId: string;
    processName: string;
    processType: string;
  } | null>(null);

  const handleStartStep = async (processId: string) => {
    if (!targetId) return;
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.startProcess(targetId, processId);
      toast.success(t('technician.alerts.processStarted', { defaultValue: 'Process started successfully' }));
      fetchFullOrder(true);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handlePauseStep = async (processId: string) => {
    if (!targetId) return;
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.pauseProcess(targetId, processId);
      toast.success(t('technician.alerts.processPaused', { defaultValue: 'Process paused' }));
      fetchFullOrder(true);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handleResumeStep = async (processId: string) => {
    if (!targetId) return;
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.resumeProcess(targetId, processId);
      toast.success(t('technician.alerts.processResumed', { defaultValue: 'Process resumed' }));
      fetchFullOrder(true);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handleCompleteStep = async (processId: string) => {
    if (!targetId) return;
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.completeProcess(targetId, processId);
      toast.success(t('technician.alerts.processCompleted', { defaultValue: 'Process completed! Next step notified.' }));
      fetchFullOrder(true);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  // Payment tab state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Target ID for fetching
  const targetId = workOrderId || initialWorkOrder?.id;

  const loadPaymentMethods = useCallback(async (branchId?: string) => {
    try {
      const methods = await paymentMethodService.getAll({ branchId, activeOnly: true });
      setAvailablePaymentMethods(methods);
    } catch (err) {
      console.error('Failed to load payment methods for ViewWorkOrderModal', err);
    }
  }, []);

  const fetchFullOrder = useCallback(async (silent = false) => {
    if (!targetId) return;
    if (!silent) setLoadingDetails(true);
    try {
      const fresh = await workOrderService.getById(targetId);
      setCurrentWO(fresh);
      setLocalNotes((fresh.notesHistory as WorkOrderNoteItem[]) || []);
      loadPaymentMethods(fresh.branchId || user?.activeBranchId);
    } catch (err: any) {
      console.error('Failed to load full work order details', err);
      if (!silent) {
        toast.error(err?.response?.data?.message || t('technician.errors.loadFailed', 'Failed to load work order'));
      }
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  }, [targetId, t, toast, loadPaymentMethods, user?.activeBranchId]);

  useEffect(() => {
    if (isOpen && targetId) {
      fetchFullOrder(false);
      setActiveTab(initialTab === 'reworks' && !hasReworks ? 'general' : initialTab || 'general');
      setShowAddNoteInput(false);
      setNewNote('');
      setEditingNoteId(null);
      setExpandedAuditProcessId(null);
      setIsRecordPaymentOpen(false);
      setPaymentMethod('');
    } else if (!isOpen) {
      setCurrentWO(null);
    }
  }, [isOpen, targetId, fetchFullOrder, initialTab]);

  // Real-time socket listener for instant Work Order updates
  useEffect(() => {
    if (!socket || !isOpen || !targetId) return;

    const handleRealtimeWorkOrderSync = (payload: any) => {
      if (payload?.workOrderId === targetId) {
        fetchFullOrder(true);
        if (onOrderUpdated) onOrderUpdated();
      }
    };

    socket.on('work_order:updated', handleRealtimeWorkOrderSync);
    socket.on('work_order:process_updated', handleRealtimeWorkOrderSync);

    return () => {
      socket.off('work_order:updated', handleRealtimeWorkOrderSync);
      socket.off('work_order:process_updated', handleRealtimeWorkOrderSync);
    };
  }, [socket, isOpen, targetId, fetchFullOrder, onOrderUpdated]);

  if (!isOpen) return null;

  // Derive calculations from currentWO
  const totalQuoteNum = Number(currentWO?.totalQuote) || 0;
  const initialPaymentNum = Number(currentWO?.initialPayment) || 0;
  const paymentsList: WorkOrderPaymentItem[] = currentWO?.payments || [];
  
  // Calculate total settled received
  const totalReceivedNum = paymentsList.length > 0
    ? paymentsList.filter((p) => p.status === 'SETTLED').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    : initialPaymentNum;

  const balancePendingNum = Math.max(0, totalQuoteNum - totalReceivedNum);

  // Payment Status
  let paymentStatusKey = 'statusPending';
  let paymentStatusColor = 'var(--text-muted)';
  let paymentStatusBg = 'var(--bg-surface)';
  if (totalReceivedNum >= totalQuoteNum && totalQuoteNum > 0) {
    paymentStatusKey = 'statusPaid';
    paymentStatusColor = '#10b981';
    paymentStatusBg = 'rgba(16, 185, 129, 0.12)';
  } else if (totalReceivedNum > 0) {
    paymentStatusKey = 'statusPartiallyPaid';
    paymentStatusColor = '#f59e0b';
    paymentStatusBg = 'rgba(245, 158, 11, 0.12)';
  }

  // Sorted process list
  const sortedProcesses: WorkOrderProcessItem[] = [...(currentWO?.processes || [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  // Find current progress step
  let currentProcess: WorkOrderProcessItem | undefined = sortedProcesses.find(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'PAUSED',
  );
  if (!currentProcess) {
    currentProcess = sortedProcesses.find((p) => p.status === 'NOT_STARTED');
  }
  if (!currentProcess && sortedProcesses.length > 0) {
    currentProcess = sortedProcesses[sortedProcesses.length - 1];
  }

  const currentStepNum = currentProcess ? sortedProcesses.indexOf(currentProcess) + 1 : 0;
  const totalSteps = sortedProcesses.length;

  // Calculate Total Completed Work Time
  const completedProcesses = sortedProcesses.filter((p) => p.status === 'COMPLETED');
  const totalSeconds = completedProcesses.reduce(
    (acc, p) => acc + (p.totalActiveDuration || 0),
    0,
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const formattedWorkTime = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
    : `${totalMinutes} mins`;

  // Determine stage milestone index
  const stageIndexMap: Record<string, number> = {
    CREATED: 0,
    ASSIGNED: 1,
    IN_PROGRESS: 2,
    INTERNAL_VERIFICATION: 3,
    EXTERNAL_VERIFICATION: 4,
    COMPLETED: 5,
  };
  const currentStageIndex = stageIndexMap[currentWO?.status || 'CREATED'] ?? 0;

  // Handle Note actions
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWO || !newNote.trim()) return;

    setAddingNote(true);
    try {
      const created = await workOrderService.addNote(currentWO.id, newNote.trim());
      setLocalNotes((prev) => [created, ...prev]);
      setNewNote('');
      setShowAddNoteInput(false);
      toast.success(t('workOrders.viewModal.generalTab.addNoteSuccess', { defaultValue: 'Note added successfully.' }));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.viewModal.generalTab.addNoteFailed', { defaultValue: 'Failed to add note.' }));
    } finally {
      setAddingNote(false);
    }
  };

  const handleStartEditNote = (item: WorkOrderNoteItem) => {
    setEditingNoteId(item.id);
    setEditingNoteText(item.note);
  };

  const handleSaveEditNote = async (noteId: string) => {
    if (!currentWO || !editingNoteText.trim()) return;
    setSavingNoteId(noteId);
    try {
      const updated = await workOrderService.updateNote(currentWO.id, noteId, editingNoteText.trim());
      setLocalNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, note: updated.note } : n)));
      setEditingNoteId(null);
      setEditingNoteText('');
      toast.success(t('workOrders.editModal.updateNoteSuccess', 'Note updated successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.editModal.updateNoteFailed', 'Failed to update note.'));
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete || !currentWO) return;
    setDeletingNote(true);
    try {
      await workOrderService.deleteNote(currentWO.id, noteToDelete.id);
      setLocalNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setNoteToDelete(null);
      toast.success(t('workOrders.editModal.deleteNoteSuccess', 'Note deleted successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.editModal.deleteNoteFailed', 'Failed to delete note.'));
    } finally {
      setDeletingNote(false);
    }
  };

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWO) return;
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error(t('workOrders.viewModal.paymentTab.invalidAmount', { defaultValue: 'Please enter a valid positive payment amount.' }));
      return;
    }

    setSubmittingPayment(true);
    try {
      const updated = await workOrderService.recordPayment(currentWO.id, {
        amount: amountVal,
        paymentMethod: paymentMethod.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        reference: paymentReference.trim() || undefined,
      });
      setCurrentWO(updated);
      setIsRecordPaymentOpen(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentNotes('');
      setPaymentReference('');
      toast.success(t('workOrders.viewModal.paymentTab.recordSuccess', 'Payment recorded successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.viewModal.paymentTab.recordFailed', 'Failed to record payment.'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStepStatusBadge = (status: string, reworkActive?: boolean) => {
    if (reworkActive) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: '999px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--rose-600, #ef4444)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
          {t('rework.activeBadge', 'Rework Active')}
        </span>
      );
    }
    switch (status) {
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--emerald-600, #10b981)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
            {t(`enums.processStatus.${status}`, 'Completed')}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: 'var(--primary-600, #2563eb)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', flexShrink: 0 }} />
            {t(`enums.processStatus.${status}`, 'In Progress')}
          </span>
        );
      case 'PAUSED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--amber-600, #d97706)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} />
            {t(`enums.processStatus.${status}`, 'Paused')}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--rose-600, #dc2626)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
            {t(`enums.processStatus.${status}`, status)}
          </span>
        );
      case 'NOT_STARTED':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'var(--bg-surface-muted, rgba(100, 116, 139, 0.08))',
              color: 'var(--text-muted, #64748b)',
              border: '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8', flexShrink: 0 }} />
            {t(`enums.processStatus.${status}`, 'Not Started')}
          </span>
        );
    }
  };

  return (
    <div
      className="modal-overlay view-wo-overlay"
      style={{
        zIndex: 1060,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content view-wo-modal"
        style={{
          maxWidth: '840px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Modal Header */}
        <div
          className="view-wo-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div className="view-wo-header-info">
            <div className="view-wo-title-row">
              <h2
                className="view-wo-title"
                style={{
                  fontSize: '19px',
                  fontWeight: 800,
                  color: 'var(--text-heading)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                WO#: {currentWO?.folioNumber || '—'}
              </h2>
            </div>
            <div className="view-wo-badges-row">
              {currentWO?.boxNumber && (
                <span
                  className="view-wo-badge view-wo-box-badge"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                    color: 'var(--primary-600)',
                  }}
                >
                  {t('workOrders.table.boxNumber', 'Box Number')}: {currentWO.boxNumber}
                </span>
              )}
              {currentWO?.deliveryDate && (
                <span
                  className="view-wo-badge view-wo-delivery-badge"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Calendar size={12} />
                  <span>{t('workOrders.table.deliveryDate', 'Delivery Date')}: {formatDate(currentWO.deliveryDate)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="view-wo-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canEdit && (
              <button
                type="button"
                onClick={handleNavigateToEdit}
                className="btn btn-secondary view-wo-edit-btn"
                title={t('workOrders.editModal.title', { defaultValue: 'Edit Work Order' })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-heading)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Pencil size={13} style={{ color: 'var(--primary-600)' }} />
                <span>{t('common.edit', 'Edit')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-icon view-wo-close-btn"
              title={t('common.close', 'Close')}
              aria-label={t('common.close', 'Close')}
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
        </div>

        {/* Tab Headers */}
        <div
          className="modal-tab-bar view-wo-tab-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 20px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'general' ? 800 : 600,
              border: 'none',
              borderBottom: activeTab === 'general' ? '2.5px solid var(--primary-600)' : '2.5px solid transparent',
              color: activeTab === 'general' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.viewModal.tabs.general', 'General')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('processes')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'processes' ? 800 : 600,
              border: 'none',
              borderBottom: activeTab === 'processes' ? '2.5px solid var(--primary-600)' : '2.5px solid transparent',
              color: activeTab === 'processes' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.viewModal.tabs.processes', 'Processes')}
          </button>

          {hasReworks && (
            <button
              type="button"
              onClick={() => setActiveTab('reworks')}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: activeTab === 'reworks' ? 800 : 600,
                border: 'none',
                borderBottom: activeTab === 'reworks' ? '2.5px solid var(--primary-600)' : '2.5px solid transparent',
                color: activeTab === 'reworks' ? 'var(--primary-600)' : 'var(--text-muted)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t('rework.tabTitle', 'Reworks')}
            </button>
          )}

          {!isTechnician && (
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: activeTab === 'payments' ? 800 : 600,
                border: 'none',
                borderBottom: activeTab === 'payments' ? '2.5px solid var(--primary-600)' : '2.5px solid transparent',
                color: activeTab === 'payments' ? 'var(--primary-600)' : 'var(--text-muted)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t('workOrders.viewModal.tabs.paymentHistory', 'Payment History')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'chat' ? 800 : 600,
              border: 'none',
              borderBottom: activeTab === 'chat' ? '2.5px solid var(--primary-600)' : '2.5px solid transparent',
              color: activeTab === 'chat' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('workOrders.viewModal.tabs.chat', 'Chat')}
          </button>
        </div>

        {/* Modal Body Container */}
        <div
          className="modal-body view-wo-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {loadingDetails && !currentWO ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spinner" style={{ margin: '0 auto 12px' }} />
              <div>{t('common.loading', 'Loading work order details...')}</div>
            </div>
          ) : !currentWO ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--rose-500)' }} />
              <div>{t('technician.errors.loadFailed', 'Failed to load work order')}</div>
            </div>
          ) : (
            <>
              {/* ═════════════════════════════════════════════════════════════ */}
              {/* TAB 1: GENERAL                                                */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {activeTab === 'general' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Top 3 Cards Grid */}
                  <div className="form-grid-3">
                    {/* Card 1: SPECIFICATIONS */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '8px',
                        }}
                      >
                        {t('workOrders.viewModal.generalTab.specifications', 'SPECIFICATIONS')}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          lineHeight: 1.45,
                          color: 'var(--text-main)',
                          fontWeight: 500,
                          overflowY: 'auto',
                          maxHeight: '80px',
                        }}
                      >
                        {currentWO.specification || '—'}
                      </div>
                    </div>

                    {/* Card 2: SHADE */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '8px',
                        }}
                      >
                        {t('workOrders.viewModal.generalTab.shade', 'SHADE')}
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: 'var(--text-heading)',
                          marginTop: '2px',
                        }}
                      >
                        {currentWO.color || '—'}
                      </div>
                    </div>

                    {/* Card 3: CURRENT PROGRESS STEP */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {t('workOrders.viewModal.generalTab.currentProgressStep', 'CURRENT PROGRESS STEP')}
                        </span>
                        {totalSteps > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--primary-600)',
                            }}
                          >
                            {t('workOrders.viewModal.generalTab.stepOf', {
                              current: currentStepNum,
                              total: totalSteps,
                              defaultValue: `Step ${currentStepNum} of ${totalSteps}`,
                            })}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: 'var(--text-heading)',
                          marginBottom: '6px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {currentProcess?.processName || '—'}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        {t('workOrders.viewModal.generalTab.assignedTechnician', 'Assigned Technician')}:{' '}
                        <strong style={{ color: 'var(--text-main)' }}>
                          {currentProcess?.technician?.name || currentProcess?.doctor?.name || '—'}
                        </strong>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {t('workOrders.viewModal.generalTab.status', 'Status')}:{' '}
                        <span style={{ fontWeight: 700, color: currentProcess?.status === 'COMPLETED' ? '#10b981' : 'var(--primary-600)' }}>
                          {currentProcess ? t(`enums.processStatus.${currentProcess.status}`, currentProcess.status) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* WORK ORDER SUMMARY DETAILS Container */}
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '8px',
                      }}
                    >
                      {t('workOrders.viewModal.generalTab.summaryDetails', 'WORK ORDER SUMMARY DETAILS')}
                    </div>

                    <div
                      style={{
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      {/* Grid Row 1 & 2 */}
                      <div className="form-grid-4">
                        {/* Patient */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.patient', 'PATIENT')}
                          </span>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '3px' }}>
                            {currentWO.patient || '—'}
                          </div>
                        </div>

                        {/* Doctor */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.doctor', 'DOCTOR')}
                          </span>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '3px' }}>
                            {currentWO.doctor?.name || '—'}
                          </div>
                        </div>

                        {/* Prosthesis Type */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.prosthesisType', 'PROSTHESIS TYPE')}
                          </span>
                          <div style={{ marginTop: '4px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                                border: '1px solid rgba(37, 99, 235, 0.25)',
                                color: 'var(--primary-600)',
                              }}
                            >
                              {currentWO.prosthesisType?.name || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Shade */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.shade', 'SHADE')}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                            {currentWO.color || '—'}
                          </div>
                        </div>

                        {/* Branch */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.branch', 'BRANCH')}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '3px' }}>
                            {currentWO.branch?.name}
                            {currentWO.branch?.code ? ` (${currentWO.branch.code})` : ''}
                          </div>
                        </div>

                        {/* Delivery Date */}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.deliveryDate', 'DELIVERY DATE')}
                          </span>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 800,
                              color: currentWO.deliveryDate ? 'var(--primary-600)' : 'var(--text-muted)',
                              marginTop: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Calendar size={13} style={{ color: currentWO.deliveryDate ? 'var(--primary-500)' : 'var(--text-muted)' }} />
                            <span>{currentWO.deliveryDate ? formatDate(currentWO.deliveryDate) : '—'}</span>
                          </div>
                        </div>

                        {/* Created At */}
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('workOrders.viewModal.generalTab.createdAt', 'CREATED AT')}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                            {formatDateTime(currentWO.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

                      {/* Notes History Accordion */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div
                            onClick={() => setIsNotesOpen(!isNotesOpen)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading)' }}>
                              {t('workOrders.viewModal.generalTab.notesHistory', 'Notes History')}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '1px 8px',
                                borderRadius: '999px',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                color: 'var(--primary-600)',
                              }}
                            >
                              {localNotes.length}
                            </span>
                            {isNotesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>

                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setShowAddNoteInput((prev) => !prev)}
                            style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px' }}
                          >
                            {t('workOrders.viewModal.generalTab.addNoteBtn', '+ Add Note')}
                          </button>
                        </div>

                        {/* Collapsible Notes Content */}
                        {isNotesOpen && (
                          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Inline Note Form */}
                            {showAddNoteInput && (
                              <form
                                onSubmit={handleAddNote}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  padding: '12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                <textarea
                                  className="form-input"
                                  rows={2}
                                  placeholder={t(
                                    'workOrders.viewModal.generalTab.writeNotePlaceholder',
                                    'Write a note or clinical update...',
                                  )}
                                  value={newNote}
                                  onChange={(e) => setNewNote(e.target.value)}
                                  disabled={addingNote}
                                  style={{ fontSize: '13px', resize: 'vertical' }}
                                  autoFocus
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowAddNoteInput(false)}
                                    disabled={addingNote}
                                  >
                                    {t('common.cancel', 'Cancel')}
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={addingNote || !newNote.trim()}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                                  >
                                    {addingNote ? <Loader2 size={13} className="spinner" /> : <Send size={13} />}
                                    <span>{t('workOrders.viewModal.generalTab.postNoteBtn', 'Post Note')}</span>
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Note Items */}
                            {localNotes.length === 0 ? (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--text-muted)',
                                  padding: '12px 0',
                                  fontStyle: 'italic',
                                }}
                              >
                                {t('workOrders.viewModal.generalTab.noNotes', 'No notes added yet.')}
                              </div>
                            ) : (
                              localNotes.map((item) => {
                                const isAuthor = item.userId === user?.id || (item.user && item.user.id === user?.id);
                                const canEditOrDelete = isAdmin || isAuthor;
                                const isEditing = editingNoteId === item.id;

                                return (
                                  <div
                                    key={item.id}
                                    style={{
                                      padding: '12px 14px',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--bg-surface)',
                                      border: '1px solid var(--border-color)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                          }}
                                        >
                                          {item.user?.name || t('workOrders.viewModal.generalTab.adminNotes', 'ADMIN NOTES')}
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

                                        {canEditOrDelete && !isEditing && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <Tooltip content={t('common.edit', 'Edit')}>
                                              <button
                                                type="button"
                                                className="btn-icon"
                                                onClick={() => handleStartEditNote(item)}
                                                style={{
                                                  width: '22px',
                                                  height: '22px',
                                                  borderRadius: '4px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  color: 'var(--text-muted)',
                                                  backgroundColor: 'transparent',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                <Pencil size={11} />
                                              </button>
                                            </Tooltip>

                                            <Tooltip content={t('common.delete', 'Delete')}>
                                              <button
                                                type="button"
                                                className="btn-icon"
                                                onClick={() => setNoteToDelete(item)}
                                                style={{
                                                  width: '22px',
                                                  height: '22px',
                                                  borderRadius: '4px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  color: 'var(--rose-500)',
                                                  backgroundColor: 'transparent',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            </Tooltip>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {isEditing ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                        <textarea
                                          rows={2}
                                          className="form-input"
                                          value={editingNoteText}
                                          onChange={(e) => setEditingNoteText(e.target.value)}
                                          disabled={savingNoteId === item.id}
                                          style={{ fontSize: '12px' }}
                                          autoFocus
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setEditingNoteId(null)}
                                            disabled={savingNoteId === item.id}
                                            style={{ padding: '3px 8px', fontSize: '11px' }}
                                          >
                                            {t('common.cancel', 'Cancel')}
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleSaveEditNote(item.id)}
                                            disabled={savingNoteId === item.id || !editingNoteText.trim()}
                                            style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
                                          >
                                            {savingNoteId === item.id ? <Loader2 size={11} className="spinner" /> : <Check size={11} />}
                                            <span>{t('common.save', 'Save')}</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '2px 0 0', lineHeight: 1.45 }}>
                                        {item.note}
                                      </p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* TAB 2: PROCESSES                                              */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {activeTab === 'processes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Card 1: TIMELINE Stepper */}
                  <div
                    style={{
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      padding: '20px 24px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '20px',
                      }}
                    >
                      {t('workOrders.viewModal.processesTab.timeline', 'TIMELINE')}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        position: 'relative',
                        padding: '0 10px',
                      }}
                    >
                      {TIMELINE_STAGES.map((stageKey, idx) => {
                        const isCompletedOrPassed = idx <= currentStageIndex;
                        const isCurrent = idx === currentStageIndex;

                        return (
                          <div
                            key={stageKey}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              position: 'relative',
                              flex: 1,
                            }}
                          >
                            {/* Connecting Line */}
                            {idx > 0 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '14px',
                                  right: '50%',
                                  width: '100%',
                                  height: '2.5px',
                                  backgroundColor: idx <= currentStageIndex ? '#10b981' : 'var(--border-color)',
                                  zIndex: 1,
                                  transition: 'background-color 0.2s ease',
                                }}
                              />
                            )}

                            {/* Circle Node */}
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: isCompletedOrPassed ? '#10b981' : 'var(--bg-card)',
                                border: isCompletedOrPassed
                                  ? '2px solid #10b981'
                                  : isCurrent
                                  ? '2px solid var(--primary-600)'
                                  : '2px solid var(--border-color)',
                                color: isCompletedOrPassed ? '#ffffff' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                zIndex: 2,
                                boxShadow: isCurrent ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : 'none',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {isCompletedOrPassed ? (
                                <Check size={16} strokeWidth={3} />
                              ) : (
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />
                              )}
                            </div>

                            {/* Label */}
                            <span
                              style={{
                                marginTop: '10px',
                                fontSize: '11px',
                                fontWeight: isCompletedOrPassed ? 700 : 500,
                                color: isCompletedOrPassed ? 'var(--text-main)' : 'var(--text-muted)',
                                textAlign: 'center',
                                maxWidth: '100px',
                                lineHeight: 1.3,
                                minHeight: '30px',
                              }}
                            >
                              {t(`workOrders.viewModal.processesTab.timelineStages.${stageKey}`, stageKey)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 2: TOTAL COMPLETED WORK TIME */}
                  <div
                    style={{
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      padding: '18px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Clock size={22} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: 'var(--text-heading)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {t('workOrders.viewModal.processesTab.totalCompletedWorkTime', 'TOTAL COMPLETED WORK TIME')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {t('workOrders.viewModal.processesTab.calculatedSubtitle', {
                            count: completedProcesses.length,
                            defaultValue: `Calculated from completed processes & verification steps (${completedProcesses.length} completed)`,
                          })}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 24px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        fontSize: '22px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {formattedWorkTime}
                    </div>
                  </div>

                  {/* Card 3: PROCESSES Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.processesTab.processesSection', 'PROCESSES')}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          color: 'var(--primary-600)',
                        }}
                      >
                        {t('workOrders.viewModal.processesTab.totalProcesses', {
                          count: sortedProcesses.length,
                          defaultValue: `Total processes: ${sortedProcesses.length}`,
                        })}
                      </span>
                    </div>

                    <div
                      style={{
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderBottom: '1px solid var(--border-color)',
                              textAlign: 'left',
                            }}
                          >
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', width: '50px', textAlign: 'center' }}>
                              {t('workOrders.viewModal.processesTab.step', 'Step')}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('workOrders.viewModal.processesTab.processName', 'Process Name')}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('workOrders.viewModal.processesTab.assignedTechnician', 'Assigned Technician')}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', width: '140px', whiteSpace: 'nowrap' }}>
                              {t('workOrders.viewModal.processesTab.timeAudit', 'Time Audit')}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {t('workOrders.viewModal.processesTab.status', 'Status')}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', width: '160px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {t('workOrders.viewModal.processesTab.actions', 'Actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedProcesses.map((proc, pIdx) => {
                            const isExt = proc.processType === 'EXTERNAL_VERIFICATION';
                            const isInt = proc.processType === 'INTERNAL_VERIFICATION' || proc.isVerification;
                            const assignee = isExt
                              ? proc.doctor?.name || currentWO.doctor?.name || '—'
                              : proc.technician?.name || '—';
                            const logsCount = proc.activityLogs?.length || 0;
                            const isAuditExpanded = expandedAuditProcessId === proc.id;

                            return (
                              <React.Fragment key={proc.id || pIdx}>
                                <tr
                                  style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    transition: 'background-color 0.15s ease',
                                  }}
                                >
                                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                                    {pIdx + 1}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, color: 'var(--text-heading)' }}>
                                        {proc.processName}
                                      </span>
                                      {proc.reworkActive && (
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            color: '#ef4444',
                                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                            padding: '2px 7px',
                                            borderRadius: '999px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                        >
                                          <RotateCcw size={10} />
                                          <span>
                                            {t('rework.activeAlertTitle', {
                                              count: proc.reworkCount || 1,
                                              defaultValue: `Rework Active (Cycle #${proc.reworkCount || 1})`,
                                            })}
                                          </span>
                                        </span>
                                      )}
                                      {!proc.reworkActive && (proc.reworkCount || 0) > 0 && (
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: '#d97706',
                                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                            padding: '2px 7px',
                                            borderRadius: '999px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                        >
                                          <RotateCcw size={10} />
                                          <span>
                                            {t('rework.repeatedBadge', {
                                              count: proc.reworkCount,
                                              defaultValue: `Reworked (${proc.reworkCount}x)`,
                                            })}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    {isExt ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          color: '#4f46e5',
                                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                          border: '1px solid rgba(99, 102, 241, 0.25)',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          marginTop: '2px',
                                        }}
                                      >
                                        <ShieldCheck size={10} />
                                        {t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification')}
                                      </span>
                                    ) : isInt ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          color: '#d97706',
                                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                          border: '1px solid rgba(245, 158, 11, 0.25)',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          marginTop: '2px',
                                        }}
                                      >
                                        <ShieldCheck size={10} />
                                        {t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification')}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {assignee}
                                  </td>
                                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedAuditProcessId(isAuditExpanded ? null : (proc.id || null))
                                      }
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: isAuditExpanded ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        color: isAuditExpanded ? 'var(--primary-600)' : 'var(--text-main)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <History size={12} />
                                      <span>
                                        {isAuditExpanded
                                          ? t('workOrders.viewModal.processesTab.hideAudit', 'Hide Audit')
                                          : t('workOrders.viewModal.processesTab.viewAudit', {
                                              count: logsCount,
                                              defaultValue: `View Audit (${logsCount})`,
                                            })}
                                      </span>
                                    </button>
                                  </td>
                                   <td style={{ padding: '12px 14px', width: '130px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {getStepStatusBadge(proc.status, proc.reworkActive)}
                                  </td>
                                  <td style={{ padding: '12px 14px', width: '160px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {(() => {
                                      const isProcReady = sortedProcesses
                                        .filter((p) => p.sequence < proc.sequence)
                                        .every((p) => p.status === 'COMPLETED');
                                      const isLoadingThis = actionLoadingProcessId === proc.id;

                                      if (proc.status === 'COMPLETED') {
                                        return (
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: '#10b981',
                                          }}>
                                            <CheckCircle2 size={13} />
                                            <span>{t('technician.status.completed', 'Completed')}</span>
                                          </span>
                                        );
                                      }

                                      if (proc.status === 'IN_PROGRESS') {
                                        if (isInt || isExt) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => setVerifyModalProcess({
                                                processId: proc.id,
                                                processName: proc.processName,
                                                processType: proc.processType,
                                              })}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#10b981',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <ShieldCheck size={12} />
                                              <span>{t('dashboard.labAdmin.endVerification', 'End Process')}</span>
                                            </button>
                                          );
                                        }

                                        return (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                              type="button"
                                              onClick={() => handlePauseStep(proc.id)}
                                              disabled={isLoadingThis}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid #fde68a',
                                                backgroundColor: '#fef3c7',
                                                color: '#d97706',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <Pause size={11} />
                                              <span>{t('workOrders.viewModal.processesTab.pause', 'Pause')}</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleCompleteStep(proc.id)}
                                              disabled={isLoadingThis}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#10b981',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <CheckCircle2 size={12} />
                                              <span>{t('workOrders.viewModal.processesTab.complete', 'Complete')}</span>
                                            </button>
                                          </div>
                                        );
                                      }

                                      if (proc.status === 'PAUSED') {
                                        return (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleResumeStep(proc.id)}
                                              disabled={isLoadingThis}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#38bdf8',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <Play size={11} fill="currentColor" />
                                              <span>{t('workOrders.viewModal.processesTab.resume', 'Resume')}</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleCompleteStep(proc.id)}
                                              disabled={isLoadingThis}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: '#10b981',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <CheckCircle2 size={12} />
                                              <span>{t('workOrders.viewModal.processesTab.complete', 'Complete')}</span>
                                            </button>
                                          </div>
                                        );
                                      }

                                      if (proc.status === 'NOT_STARTED') {
                                        if (isProcReady) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => handleStartStep(proc.id)}
                                              disabled={isLoadingThis}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: isInt || isExt ? '#0284c7' : '#38bdf8',
                                                color: '#ffffff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: isLoadingThis ? 'wait' : 'pointer',
                                              }}
                                            >
                                              <Play size={11} fill="currentColor" />
                                              <span>
                                                {isInt || isExt
                                                  ? t('dashboard.labAdmin.startVerification', 'Start Verification')
                                                  : t('workOrders.viewModal.processesTab.startProcess', 'Start Process')}
                                              </span>
                                            </button>
                                          );
                                        }

                                        return (
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                          }}>
                                            <Lock size={12} />
                                            <span>{t('workOrders.viewModal.processesTab.waitingPrior', { n: proc.sequence, defaultValue: 'Waiting Prior' })}</span>
                                          </span>
                                        );
                                      }

                                      return null;
                                    })()}
                                  </td>
                                </tr>

                                {/* Expanded Process Activity History */}
                                {isAuditExpanded && (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '14px 20px', backgroundColor: 'var(--bg-surface)' }}>
                                      <div
                                        style={{
                                          borderRadius: '8px',
                                          border: '1px solid var(--border-color)',
                                          backgroundColor: 'var(--bg-card)',
                                          padding: '16px 20px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            marginBottom: '14px',
                                          }}
                                        >
                                          {t('workOrders.viewModal.processesTab.activityHistoryTitle', {
                                            processName: proc.processName.toUpperCase(),
                                            defaultValue: `PROCESS ACTIVITY HISTORY — ${proc.processName.toUpperCase()}`,
                                          })}
                                        </div>

                                        {logsCount === 0 ? (
                                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {t('workOrders.viewModal.processesTab.noActivityLogs', 'No activity logs recorded for this process.')}
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {proc.activityLogs?.map((al, alIdx) => {
                                              const { actionTitle, dotColor, notesText, isRework } = formatAuditLog(
                                                al,
                                                t,
                                                i18n.language,
                                                proc.processName,
                                              );

                                              return (
                                                <div key={al.id || alIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                  <div
                                                    style={{
                                                      width: '9px',
                                                      height: '9px',
                                                      borderRadius: '50%',
                                                      backgroundColor: dotColor,
                                                      marginTop: '4px',
                                                      flexShrink: 0,
                                                      boxShadow: isRework ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined,
                                                    }}
                                                  />
                                                  <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                      <span style={{ fontSize: '12px', fontWeight: 800, color: dotColor }}>
                                                        {actionTitle}
                                                      </span>
                                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {formatDateTime(al.timestamp)}
                                                      </span>
                                                    </div>
                                                    {notesText && (
                                                      <div
                                                        style={{
                                                          fontSize: '12px',
                                                          color: isRework ? '#ef4444' : 'var(--text-muted)',
                                                          fontStyle: isRework ? 'normal' : 'italic',
                                                          fontWeight: isRework ? 600 : 400,
                                                          marginTop: '2px',
                                                        }}
                                                      >
                                                        {notesText}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* TAB: REWORKS AUDIT TRAIL                                      */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {activeTab === 'reworks' && hasReworks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div
                    style={{
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header Row: Title & Total Rework Cycles Badge */}
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('rework.auditTrailTitle', 'REWORK CYCLE AUDIT TRAIL')}
                      </div>

                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '4px 12px',
                          borderRadius: '6px',
                        }}
                      >
                        {t('rework.totalCycles', {
                          count: reworkCycles.length,
                          defaultValue: `Total Rework Cycles: ${reworkCycles.length}`,
                        })}
                      </span>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderBottom: '1px solid var(--border-color)',
                              textAlign: 'left',
                            }}
                          >
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('rework.columns.processName', 'Process Name')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('rework.columns.reworkCount', 'Rework Count')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('rework.columns.initiatedBy', 'Initiated By')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {t('rework.columns.initiationDateTime', 'Initiation Date/Time')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('rework.columns.triggeringStage', 'Triggering Stage')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('rework.columns.assignedTechnician', 'Assigned Technician')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {t('rework.columns.completionDateTime', 'Completion Date/Time')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {t('rework.columns.approvalDateTime', 'Approval Date/Time')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
                              {t('rework.columns.status', 'Status')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reworkCycles.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
                                style={{
                                  padding: '32px 16px',
                                  textAlign: 'center',
                                  color: 'var(--text-muted)',
                                  fontSize: '13px',
                                }}
                              >
                                {t('rework.noCycles', 'No rework cycles recorded for this work order.')}
                              </td>
                            </tr>
                          ) : (
                            reworkCycles.map((cycle, cIdx) => {
                            const isCompleted = cycle.status === 'Completed' || cycle.status === 'Approved';
                            const isInProgress = cycle.status === 'In Progress';

                            const statusBg = isCompleted
                              ? 'rgba(14, 165, 233, 0.12)'
                              : isInProgress
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(100, 116, 139, 0.12)';

                            const statusColor = isCompleted
                              ? '#0284c7'
                              : isInProgress
                              ? '#d97706'
                              : '#64748b';

                            const statusBorder = isCompleted
                              ? '1px solid rgba(14, 165, 233, 0.25)'
                              : isInProgress
                              ? '1px solid rgba(245, 158, 11, 0.25)'
                              : '1px solid rgba(100, 116, 139, 0.25)';

                            return (
                              <tr
                                key={cycle.processId + '-' + cIdx}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  transition: 'background-color 0.15s ease',
                                }}
                              >
                                <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-heading)' }}>
                                  {cycle.processName}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {cycle.reworkCount}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                                  {cycle.initiatedBy}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                  {cycle.initiationDateTime ? formatDateTime(cycle.initiationDateTime) : '—'}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {cycle.triggeringStage}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {cycle.assignedTechnician}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                  {cycle.completionDateTime ? formatDateTime(cycle.completionDateTime) : '—'}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                  {cycle.approvalDateTime ? formatDateTime(cycle.approvalDateTime) : '—'}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 12px',
                                      borderRadius: '999px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      backgroundColor: statusBg,
                                      color: statusColor,
                                      border: statusBorder,
                                    }}
                                  >
                                    {cycle.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          }))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* TAB 3: PAYMENT HISTORY                                        */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {activeTab === 'payments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Top 4 Financial Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '14px',
                    }}
                  >
                    {/* Card 1: TOTAL PRICE */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.paymentTab.totalPrice', 'TOTAL PRICE')}
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '8px' }}>
                        {formatCurrency(totalQuoteNum)}
                      </div>
                    </div>

                    {/* Card 2: RECEIVED AMOUNT */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.paymentTab.receivedAmount', 'RECEIVED AMOUNT')}
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>
                        {formatCurrency(totalReceivedNum)}
                      </div>
                    </div>

                    {/* Card 3: PENDING AMOUNT */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.paymentTab.pendingAmount', 'PENDING AMOUNT')}
                      </div>
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 800,
                          color: balancePendingNum > 0 ? '#ef4444' : '#10b981',
                          marginTop: '8px',
                        }}
                      >
                        {formatCurrency(balancePendingNum)}
                      </div>
                    </div>

                    {/* Card 4: PAYMENT STATUS */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.paymentTab.paymentStatus', 'PAYMENT STATUS')}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '999px',
                            backgroundColor: paymentStatusBg,
                            color: paymentStatusColor,
                          }}
                        >
                          {t(`workOrders.viewModal.paymentTab.${paymentStatusKey}`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PAYMENT TRANSACTIONS Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t('workOrders.viewModal.paymentTab.paymentTransactions', 'PAYMENT TRANSACTIONS')}
                      </span>

                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setIsRecordPaymentOpen(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 700,
                            padding: '6px 14px',
                          }}
                        >
                          <PlusCircle size={14} />
                          <span>{t('workOrders.viewModal.paymentTab.recordPaymentBtn', 'Record Payment')}</span>
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderBottom: '1px solid var(--border-color)',
                              textAlign: 'left',
                            }}
                          >
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('workOrders.viewModal.paymentTab.paymentDate', 'Payment Date')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('workOrders.viewModal.paymentTab.receivedAmount', 'Received Amount')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('labPaymentMethods.fieldMethod', 'Payment Method')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {t('workOrders.viewModal.paymentTab.notes', 'Notes')}
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                              {t('workOrders.viewModal.generalTab.status', 'Status')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsList.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                                {t('workOrders.viewModal.paymentTab.noTransactions', 'No payment transactions recorded yet.')}
                              </td>
                            </tr>
                          ) : (
                            paymentsList.map((item, idx) => (
                              <tr
                                key={item.id || idx}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  transition: 'background-color 0.15s ease',
                                }}
                              >
                                <td style={{ padding: '14px 16px', color: 'var(--text-main)' }}>
                                  {formatDateTime(item.createdAt)}
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-heading)' }}>
                                  {formatCurrency(item.amount)}
                                </td>
                                <td style={{ padding: '14px 16px', color: 'var(--text-main)' }}>
                                  {item.paymentMethod ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary-600)',
                                        border: '1px solid rgba(99, 102, 241, 0.25)',
                                      }}
                                    >
                                      {item.paymentMethod}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  {item.notes || '—'}
                                  {item.reference && (
                                    <span
                                      style={{
                                        marginLeft: '8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        fontStyle: 'normal',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                      }}
                                    >
                                      Ref: {item.reference}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '3px 10px',
                                      borderRadius: '999px',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.25)',
                                    }}
                                  >
                                    {t('workOrders.viewModal.paymentTab.statusSettled', 'Settled')}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════ */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {/* TAB: CHAT                                                     */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {activeTab === 'chat' && (
                <WorkOrderChatTab
                  workOrderId={currentWO.id}
                  workOrder={currentWO}
                  onMessageSent={onOrderUpdated}
                />
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer view-wo-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {canEdit && (
              <button
                type="button"
                onClick={handleNavigateToEdit}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                <Pencil size={14} style={{ color: 'var(--primary-600)' }} />
                <span>{t('workOrders.editModal.title', { defaultValue: 'Edit Work Order' })}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary"
              style={{ fontWeight: 700, padding: '8px 24px', minWidth: '90px' }}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </div>

      {/* ─── RECORD PAYMENT POPUP MODAL ─── */}
      {isRecordPaymentOpen && (
        <div className="modal-overlay" style={{ zIndex: 1080 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              padding: '24px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                  {t('workOrders.viewModal.paymentTab.modalTitle', 'Record Payment')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {t('workOrders.viewModal.paymentTab.modalSubtitle', 'Register a payment transaction for this work order')}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsRecordPaymentOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  {t('workOrders.viewModal.paymentTab.amount', 'Received Amount')} *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ paddingLeft: '28px', fontSize: '15px', fontWeight: 700 }}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  {t('labPaymentMethods.fieldMethod', 'Payment Method')}
                </label>
                <select
                  className="form-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="">{t('common.select', 'Select payment method...')}</option>
                  {availablePaymentMethods.map((m) => (
                    <option key={m.id || m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  {t('workOrders.viewModal.paymentTab.reference', 'Reference / Receipt Folio (Optional)')}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. REC-10293 or Card Ref"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  {t('workOrders.viewModal.paymentTab.notes', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={t('workOrders.viewModal.paymentTab.notesPlaceholder', 'Enter notes or transaction details...')}
                  style={{ resize: 'vertical', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  disabled={submittingPayment}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingPayment || !paymentAmount}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  {submittingPayment ? <Loader2 size={15} className="spinner" /> : <PlusCircle size={15} />}
                  <span>{t('workOrders.viewModal.paymentTab.recordPaymentBtn', 'Record Payment')}</span>
                </button>
              </div>
            </form>
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
                'Are you sure you want to delete this note? This action cannot be undone.',
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
      {/* ─── EDIT WORK ORDER MODAL (INTERNAL FALLBACK) ─────────── */}
      {isEditModalOpen && currentWO && (
        <EditWorkOrderModal
          workOrder={currentWO}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            fetchFullOrder(false);
            if (onOrderUpdated) onOrderUpdated();
            setIsEditModalOpen(false);
          }}
        />
      )}
      {/* ─── VERIFY WORK ORDER MODAL ─────────── */}
      {verifyModalProcess && currentWO && (
        <VerifyWorkOrderModal
          isOpen={Boolean(verifyModalProcess)}
          onClose={() => setVerifyModalProcess(null)}
          workOrderId={currentWO.id}
          folioNumber={currentWO.folioNumber}
          patient={currentWO.patient || ''}
          processId={verifyModalProcess.processId}
          processName={verifyModalProcess.processName}
          processType={verifyModalProcess.processType}
          doctorName={currentWO.doctor?.name}
          doctorType={currentWO.doctor?.type}
          onComplete={() => {
            setVerifyModalProcess(null);
            fetchFullOrder(true);
            if (onOrderUpdated) onOrderUpdated();
          }}
        />
      )}
    </div>
  );
};

export default ViewWorkOrderModal;
