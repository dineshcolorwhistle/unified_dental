import React, { useState, useEffect } from 'react';
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
  Hash,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkOrderListItem, workOrderService, WorkOrderNoteItem } from '../../services/workOrderService';
import { formatDate, formatDateTime, formatCurrency } from '../../core/utils/dateUtils';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { Tooltip } from '../common/Tooltip';

interface ViewWorkOrderModalProps {
  workOrder: WorkOrderListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export const ViewWorkOrderModal: React.FC<ViewWorkOrderModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const isAdmin = Boolean(isTenantAdmin || isLabAdmin || user?.isSuperAdmin);

  const [activeTab, setActiveTab] = useState<'details' | 'workflow' | 'notes'>('details');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState<WorkOrderNoteItem[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<WorkOrderNoteItem | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  // Sync notes when modal opens
  useEffect(() => {
    if (workOrder) {
      setLocalNotes((workOrder.notesHistory as WorkOrderNoteItem[]) || []);
      setActiveTab('details');
      setNewNote('');
      setEditingNoteId(null);
      setEditingNoteText('');
      setNoteToDelete(null);
    }
  }, [workOrder]);

  if (!isOpen || !workOrder) return null;

  const totalQuoteNum = Number(workOrder.totalQuote) || 0;
  const initialPaymentNum = Number(workOrder.initialPayment) || 0;
  const balanceDueNum = Math.max(0, totalQuoteNum - initialPaymentNum);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNote.trim();
    if (!text) return;

    setAddingNote(true);
    try {
      const created = await workOrderService.addNote(workOrder.id, text);
      setLocalNotes((prev) => [created, ...prev]);
      setNewNote('');
      toast.success(t('workOrders.notesModal.addSuccess', 'Note added successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      console.error('Failed to add note', err);
      toast.error(t('workOrders.notesModal.addFailed', 'Failed to add note.'));
    } finally {
      setAddingNote(false);
    }
  };

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
    if (!text || !workOrder) return;

    setSavingNoteId(noteId);
    try {
      const updated = await workOrderService.updateNote(workOrder.id, noteId, text);
      setLocalNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, note: updated.note } : n))
      );
      setEditingNoteId(null);
      setEditingNoteText('');
      toast.success(t('workOrders.editModal.updateNoteSuccess', 'Note updated successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      console.error('Failed to update note', err);
      toast.error(err?.response?.data?.message || t('workOrders.editModal.updateNoteFailed', 'Failed to update note.'));
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete || !workOrder) return;
    setDeletingNote(true);
    try {
      await workOrderService.deleteNote(workOrder.id, noteToDelete.id);
      setLocalNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setNoteToDelete(null);
      toast.success(t('workOrders.editModal.deleteNoteSuccess', 'Note deleted successfully.'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      console.error('Failed to delete note', err);
      toast.error(err?.response?.data?.message || t('workOrders.editModal.deleteNoteFailed', 'Failed to delete note.'));
    } finally {
      setDeletingNote(false);
    }
  };

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
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: 0, fontFamily: 'monospace' }}>
                  {workOrder.folioNumber}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                >
                  {t(`enums.workOrderStatus.${workOrder.status}`, workOrder.status)}
                </span>
                {workOrder.boxNumber && (
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
                    {workOrder.boxNumber}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('workOrders.table.createdAt', 'Created At')}: {formatDateTime(workOrder.createdAt)} • {t('workOrders.table.createdBy', 'Created By')}: {workOrder.createdBy?.name || '—'}
              </p>
            </div>
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

        {/* Tab switcher */}
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
            onClick={() => setActiveTab('details')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'details' ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 'details' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            {t('workOrders.viewModal.orderInfo', 'Order Information')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'workflow' ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 'workflow' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{t('workOrders.viewModal.processWorkflow', 'Production & Verification Workflow')}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: activeTab === 'workflow' ? 'rgba(37, 99, 235, 0.15)' : 'var(--badge-neutral-bg)',
                color: activeTab === 'workflow' ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              {workOrder.processes?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'notes' ? '2px solid var(--primary-600)' : '2px solid transparent',
              color: activeTab === 'notes' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{t('workOrders.notesModal.title', 'Notes & History')}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: activeTab === 'notes' ? 'rgba(37, 99, 235, 0.15)' : 'var(--badge-neutral-bg)',
                color: activeTab === 'notes' ? 'var(--primary-600)' : 'var(--text-muted)',
              }}
            >
              {localNotes.length}
            </span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div
          className="modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Row 1: Patient & Doctor Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary-600)' }}>
                    <User size={18} />
                    <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t('workOrders.table.patient', 'Patient')}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '4px' }}>
                    {workOrder.patient || '—'}
                  </div>
                  {workOrder.fileNumber && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={12} />
                      <span>{t('workOrders.form.fileNumber', 'File Number')}: <strong>{workOrder.fileNumber}</strong></span>
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} />
                    <span>{t('workOrders.form.deliveryDate', 'Delivery Date')}: <strong>{workOrder.deliveryDate ? formatDate(workOrder.deliveryDate) : '—'}</strong></span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary-600)' }}>
                    <Stethoscope size={18} />
                    <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t('workOrders.viewModal.doctorInfo', 'Doctor & Clinic')}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '4px' }}>
                    {workOrder.doctor?.name || '—'}
                  </div>
                  {workOrder.doctor?.clinicName && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {workOrder.doctor.clinicName}
                    </div>
                  )}
                  {workOrder.branch && (
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '6px' }}>
                      {t('workOrders.form.branch', 'Branch')}: {workOrder.branch.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Prosthesis & Color */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary-600)' }}>
                  <Layers size={18} />
                  <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('workOrders.viewModal.prosthesisInfo', 'Prosthesis & Aesthetics')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('workOrders.table.prosthesis', 'Prosthesis Type')}
                    </label>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                      {workOrder.prosthesisType?.name || '—'}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-main)', margin: '6px 0 0', lineHeight: 1.5 }}>
                      {workOrder.specification}
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('workOrders.table.color', 'Color / Shade')}
                    </label>
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          fontSize: '13px',
                          fontWeight: 800,
                          color: 'var(--primary-600)',
                        }}
                      >
                        {workOrder.color || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Financials */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary-600)' }}>
                  <DollarSign size={18} />
                  <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('workOrders.viewModal.financials', 'Financial Summary')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {t('workOrders.viewModal.totalQuote', 'Total Quote')}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                      {formatCurrency(totalQuoteNum)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {t('workOrders.viewModal.initialPayment', 'Initial Payment')}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {formatCurrency(initialPaymentNum)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {t('workOrders.viewModal.balanceDue', 'Balance Due')}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: balanceDueNum > 0 ? '#f59e0b' : '#10b981', marginTop: '2px' }}>
                      {formatCurrency(balanceDueNum)}
                    </div>
                  </div>
                </div>

                {/* References */}
                {Array.isArray(workOrder.paymentReferenceNumbers) && workOrder.paymentReferenceNumbers.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      {t('workOrders.viewModal.paymentReferences', 'Payment Reference Numbers')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {workOrder.paymentReferenceNumbers.map((ref) => (
                        <span
                          key={ref}
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WORKFLOW STEPS */}
          {activeTab === 'workflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(!workOrder.processes || workOrder.processes.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  {t('workOrders.noProcesses', 'No process steps added yet')}
                </div>
              ) : (
                workOrder.processes.map((proc: any, idx: number) => {
                  const isExt = proc.processType === 'EXTERNAL_VERIFICATION';
                  const isInt = proc.processType === 'INTERNAL_VERIFICATION' || proc.isVerification;
                  const assigneeName = isExt
                    ? proc.doctor?.name || workOrder.doctor?.name || t('workOrders.assignedDoctor', 'Assigned Doctor')
                    : proc.technician?.name || '—';

                  return (
                    <div
                      key={proc.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-card)',
                        border: isExt
                          ? '1px solid rgba(99, 102, 241, 0.35)'
                          : isInt
                          ? '1px solid rgba(245, 158, 11, 0.35)'
                          : '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                            color: isExt ? '#4f46e5' : isInt ? '#d97706' : 'var(--primary-600)',
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
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-heading)' }}>
                            {proc.processName}
                          </div>
                          {isExt ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#4f46e5',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginTop: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ShieldCheck size={11} />
                              {t('labProcesses.types.EXTERNAL_VERIFICATION', 'External Verification')}
                            </span>
                          ) : isInt ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#d97706',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginTop: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ShieldCheck size={11} />
                              {t('labProcesses.types.INTERNAL_VERIFICATION', 'Internal Verification')}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                            {t('labProcesses.table.assignee', 'Assignee')}
                          </span>
                          {assigneeName}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: proc.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                            color: proc.status === 'COMPLETED' ? '#10b981' : 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {String(t(`enums.processStatus.${proc.status}`, proc.status || 'NOT_STARTED'))}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: NOTES & HISTORY */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Note input */}
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('workOrders.viewModal.addNotePlaceholder', 'Write a note or update...')}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  disabled={addingNote}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addingNote || !newNote.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  {addingNote ? <Loader2 size={15} className="spinner" /> : <Send size={15} />}
                  <span>{t('workOrders.viewModal.addNoteBtn', 'Post Note')}</span>
                </button>
              </form>

              {/* Notes list */}
              {localNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <MessageSquare size={26} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
                  <p style={{ margin: 0 }}>{t('workOrders.viewModal.noNotes', 'No notes added yet.')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {localNotes.map((item) => {
                    const isAuthor = item.userId === user?.id || (item.user && item.user.id === user?.id);
                    const canEditOrDelete = isAdmin || isAuthor;
                    const isEditing = editingNoteId === item.id;

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
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
                          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
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

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontWeight: 600, padding: '8px 20px' }}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>

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
