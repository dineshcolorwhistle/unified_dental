import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  WorkOrderListItem,
  workOrderService,
  WorkOrderNoteItem,
  WorkOrderPaymentItem,
  WorkOrderProcessItem,
} from '../../services/workOrderService';
import { formatDate, formatDateTime, formatTime, formatCurrency } from '../../core/utils/dateUtils';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { Tooltip } from '../common/Tooltip';
import { WorkOrderChatTab } from './WorkOrderChatTab';

export interface ViewWorkOrderModalProps {
  workOrder?: WorkOrderListItem | null;
  workOrderId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
  initialTab?: 'general' | 'processes' | 'payments' | 'chat';
}

type TabKey = 'general' | 'processes' | 'payments' | 'chat';

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
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const isAdmin = Boolean(isTenantAdmin || isLabAdmin || user?.isSuperAdmin);
  const isTechnician = !isAdmin;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'general');
  const [currentWO, setCurrentWO] = useState<WorkOrderListItem | null>(initialWorkOrder || null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'general');
    }
  }, [isOpen, initialTab]);

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

  // Payment tab state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Target ID for fetching
  const targetId = workOrderId || initialWorkOrder?.id;

  const fetchFullOrder = useCallback(async (silent = false) => {
    if (!targetId) return;
    if (!silent) setLoadingDetails(true);
    try {
      const fresh = await workOrderService.getById(targetId);
      setCurrentWO(fresh);
      setLocalNotes((fresh.notesHistory as WorkOrderNoteItem[]) || []);
    } catch (err: any) {
      console.error('Failed to load full work order details', err);
      if (!silent) {
        toast.error(err?.response?.data?.message || t('technician.errors.loadFailed', 'Failed to load work order'));
      }
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  }, [targetId, t, toast]);

  useEffect(() => {
    if (isOpen && targetId) {
      fetchFullOrder(false);
      setActiveTab(initialTab || 'general');
      setShowAddNoteInput(false);
      setNewNote('');
      setEditingNoteId(null);
      setExpandedAuditProcessId(null);
      setIsRecordPaymentOpen(false);
    } else if (!isOpen) {
      setCurrentWO(null);
    }
  }, [isOpen, targetId, fetchFullOrder, initialTab]);

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
        notes: paymentNotes.trim() || undefined,
        reference: paymentReference.trim() || undefined,
      });
      setCurrentWO(updated);
      setIsRecordPaymentOpen(false);
      setPaymentAmount('');
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

  const getStepStatusBadge = (status: string) => {
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
      className="modal-overlay"
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
        className="modal-content"
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
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
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
            {currentWO?.boxNumber && (
              <span
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

        {/* Tab Headers */}
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
          className="modal-body"
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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1.3fr',
                      gap: '14px',
                    }}
                  >
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
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '16px',
                        }}
                      >
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
                                    <div style={{ fontWeight: 800, color: 'var(--text-heading)' }}>
                                      {proc.processName}
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
                                    {getStepStatusBadge(proc.status)}
                                  </td>
                                </tr>

                                {/* Expanded Process Activity History */}
                                {isAuditExpanded && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: '14px 20px', backgroundColor: 'var(--bg-surface)' }}>
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
                                              const isComplete = al.action === 'COMPLETE';
                                              const isStart = al.action === 'START';
                                              const isPause = al.action === 'PAUSE';

                                              const dotColor = isComplete
                                                ? '#10b981'
                                                : isStart
                                                ? 'var(--primary-600)'
                                                : isPause
                                                ? '#f59e0b'
                                                : '#8b5cf6';

                                              const label = isComplete
                                                ? t('technician.auditLog.processCompleted', 'Process Completed')
                                                : isStart
                                                ? t('technician.auditLog.processStarted', 'Process Started')
                                                : isPause
                                                ? t('technician.auditLog.processPaused', 'Process Paused')
                                                : t('technician.auditLog.processResumed', 'Process Resumed');

                                              const subText = al.notes || (isComplete
                                                ? t('workOrders.viewModal.processesTab.activeTimeMinutes', {
                                                    minutes: Math.round((proc.totalActiveDuration || 0) / 60),
                                                    defaultValue: `Process completed. Active time: ${Math.round((proc.totalActiveDuration || 0) / 60)} minutes.`,
                                                  })
                                                : isStart
                                                ? t('workOrders.viewModal.processesTab.startedByTech', 'Process started by technician')
                                                : null);

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
                                                    }}
                                                  />
                                                  <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                      <span style={{ fontSize: '12px', fontWeight: 800, color: dotColor }}>
                                                        {label}
                                                      </span>
                                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {formatDateTime(al.timestamp)}
                                                      </span>
                                                    </div>
                                                    {subText && (
                                                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                                        {subText}
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
                              <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
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
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
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
    </div>
  );
};

export default ViewWorkOrderModal;
