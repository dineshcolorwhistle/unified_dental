import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Printer,
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  CheckCircle2,
  Lock,
  Clock,
  Send,
  MessageSquare,
  Activity,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { formatDate, formatTime } from '../../core/utils/dateUtils';
import {
  workOrderService,
  WorkOrderListItem,
  WorkOrderProcessItem,
  ProcessActivityLogItem,
} from '../../services/workOrderService';
import { PrintQrModal } from './PrintQrModal';

interface TechnicianWorkOrderDetailModalProps {
  workOrderId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export const TechnicianWorkOrderDetailModal: React.FC<TechnicianWorkOrderDetailModalProps> = ({
  workOrderId,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();

  const [workOrder, setWorkOrder] = useState<WorkOrderListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'process' | 'chat'>('general');
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Live timer for in-progress step
  const [activeDurationSec, setActiveDurationSec] = useState<number>(0);

  const fetchWorkOrder = async () => {
    try {
      const data = await workOrderService.getById(workOrderId);
      setWorkOrder(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.loadFailed', { defaultValue: 'Failed to load work order' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrder();
  }, [workOrderId]);

  // Identify assigned step for current technician
  const myProcess: WorkOrderProcessItem | undefined = workOrder?.processes?.find(
    (p) => p.technicianId === user?.id,
  );

  // Live timer ticker when process is IN_PROGRESS
  useEffect(() => {
    if (!myProcess || myProcess.status !== 'IN_PROGRESS') {
      setActiveDurationSec(myProcess?.totalActiveDuration || 0);
      return;
    }

    const baseDuration = myProcess.totalActiveDuration || 0;
    const startRef = myProcess.lastPausedAt
      ? new Date(myProcess.lastPausedAt).getTime()
      : myProcess.startedAt
      ? new Date(myProcess.startedAt).getTime()
      : Date.now();

    const interval = setInterval(() => {
      const currentElapsed = Math.max(0, Math.floor((Date.now() - startRef) / 1000));
      setActiveDurationSec(baseDuration + currentElapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [myProcess?.status, myProcess?.startedAt, myProcess?.totalActiveDuration]);

  // Check if my step is ready to start (all prior steps completed)
  const isReadyToStart = React.useMemo(() => {
    if (!workOrder || !myProcess) return false;
    const priorIncomplete = workOrder.processes.find(
      (p) => p.sequence < myProcess.sequence && p.status !== 'COMPLETED',
    );
    return !priorIncomplete;
  }, [workOrder, myProcess]);

  const priorProcess = React.useMemo(() => {
    if (!workOrder || !myProcess) return null;
    return workOrder.processes.find(
      (p) => p.sequence < myProcess.sequence && p.status !== 'COMPLETED',
    );
  }, [workOrder, myProcess]);

  // Handle Timing Actions: Start, Pause, Resume, Complete
  const handleStartProcess = async () => {
    if (!myProcess?.id) return;
    setActionLoading(true);
    try {
      const updated = await workOrderService.startProcess(workOrderId, myProcess.id);
      setWorkOrder(updated);
      toast.success(t('technician.alerts.processStarted', { defaultValue: 'Process started successfully' }));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseProcess = async () => {
    if (!myProcess?.id) return;
    setActionLoading(true);
    try {
      const updated = await workOrderService.pauseProcess(workOrderId, myProcess.id);
      setWorkOrder(updated);
      toast.success(t('technician.alerts.processPaused', { defaultValue: 'Process paused' }));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeProcess = async () => {
    if (!myProcess?.id) return;
    setActionLoading(true);
    try {
      const updated = await workOrderService.resumeProcess(workOrderId, myProcess.id);
      setWorkOrder(updated);
      toast.success(t('technician.alerts.processResumed', { defaultValue: 'Process resumed' }));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteProcess = async () => {
    if (!myProcess?.id) return;
    setActionLoading(true);
    try {
      const updated = await workOrderService.completeProcess(workOrderId, myProcess.id);
      setWorkOrder(updated);
      toast.success(t('technician.alerts.processCompleted', { defaultValue: 'Process completed! Next step notified.' }));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Note Submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      await workOrderService.addNote(workOrderId, newNote.trim());
      setNewNote('');
      toast.success(t('technician.alerts.noteAdded', { defaultValue: 'Note added successfully' }));
      fetchWorkOrder();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.noteFailed', { defaultValue: 'Failed to add note' }));
    } finally {
      setSubmittingNote(false);
    }
  };

  // Format seconds into "41s" or "2m 15s"
  const formatDurationDisplay = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Extract all activity logs across processes for chronological audit log
  const allActivityLogs: Array<ProcessActivityLogItem & { processName: string }> = React.useMemo(() => {
    if (!workOrder?.processes) return [];
    const logs: Array<ProcessActivityLogItem & { processName: string }> = [];
    for (const proc of workOrder.processes) {
      if (Array.isArray(proc.activityLogs)) {
        for (const al of proc.activityLogs) {
          logs.push({
            ...al,
            processName: proc.processName,
          });
        }
      }
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [workOrder]);

  if (loading || !workOrder) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '32px',
            borderRadius: '16px',
            color: 'var(--primary-600)',
            fontWeight: 600,
          }}
        >
          {t('common.loading', { defaultValue: 'Loading work order details...' })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  color: 'var(--text-heading)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                WO#: {workOrder.folioNumber}
              </h2>
              {workOrder.patient && (
                <span
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    padding: '2px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {workOrder.patient}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  backgroundColor: '#f0f9ff',
                  color: '#0284c7',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
              >
                <Printer size={13} />
                <span>{t('technician.printQr', { defaultValue: 'Print QR' })}</span>
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('technician.modalSubtitle', { defaultValue: 'Update active step status, request help, or audit logs' })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            gap: '24px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: activeTab === 'general' ? 700 : 500,
              color: activeTab === 'general' ? 'var(--primary-600)' : 'var(--text-muted)',
              borderBottom: activeTab === 'general' ? '2px solid var(--primary-600)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('technician.tabs.generalInfo', { defaultValue: 'General Information' })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('process')}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: activeTab === 'process' ? 700 : 500,
              color: activeTab === 'process' ? 'var(--primary-600)' : 'var(--text-muted)',
              borderBottom: activeTab === 'process' ? '2px solid var(--primary-600)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('technician.tabs.processAudit', { defaultValue: 'Process & Audit' })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: activeTab === 'chat' ? 700 : 500,
              color: activeTab === 'chat' ? 'var(--primary-600)' : 'var(--text-muted)',
              borderBottom: activeTab === 'chat' ? '2px solid var(--primary-600)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t('technician.tabs.chat', { defaultValue: 'Chat' })}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-app)' }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Metadata Grid (Screenshot 3) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '16px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('technician.createdOn', { defaultValue: 'CREATED ON' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    <Calendar size={14} style={{ color: 'var(--primary-500)' }} />
                    <span>{formatDate(workOrder.createdAt)}</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('technician.doctor', { defaultValue: 'DOCTOR' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    <UserIcon size={14} style={{ color: 'var(--primary-500)' }} />
                    <span>
                      {workOrder.doctor?.name || '—'}
                      {workOrder.doctor?.clinicName ? ` (${workOrder.doctor.clinicName})` : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('technician.colorShade', { defaultValue: 'COLOR / SHADE' })}
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ backgroundColor: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 600 }}>
                      {workOrder.color || 'A1'}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('technician.boxNumber', { defaultValue: 'BOX NUMBER' })}
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ backgroundColor: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 600 }}>
                      {workOrder.boxNumber || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dental Spec / Instructions (Screenshot 3) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {t('technician.dentalSpec', { defaultValue: 'DENTAL SPEC / INSTRUCTIONS' })}
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    lineHeight: '1.5',
                  }}
                >
                  {workOrder.specification || t('common.noSpecifications', { defaultValue: 'No specifications provided.' })}
                </div>
              </div>

              {/* Accordion: Notes History (Screenshot 3) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsNotesOpen(!isNotesOpen)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    backgroundColor: 'var(--bg-card)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    color: 'var(--text-heading)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} style={{ color: 'var(--primary-600)' }} />
                    <span>{t('technician.notesHistory', { defaultValue: 'Notes History' })}</span>
                    <span
                      style={{
                        backgroundColor: '#e0f2fe',
                        color: '#0284c7',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {(workOrder.notesHistory?.length || 0) + (workOrder.notes ? 1 : 0)}
                    </span>
                  </div>
                  {isNotesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isNotesOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                    {/* Admin Notes Box */}
                    {workOrder.notes && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          {t('technician.adminNotes', { defaultValue: 'ADMIN NOTES' })}
                        </div>
                        <div
                          style={{
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#0369a1',
                          }}
                        >
                          {workOrder.notes}
                        </div>
                      </div>
                    )}

                    {/* Notes History Items */}
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {t('technician.notesList', { defaultValue: 'Notes History' })}
                      </div>

                      {workOrder.notesHistory && workOrder.notesHistory.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {workOrder.notesHistory.map((note) => (
                            <div
                              key={note.id}
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                padding: '12px 16px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                                    {note.user?.name || 'User'}
                                  </span>
                                  <span
                                    style={{
                                      backgroundColor: '#e0f2fe',
                                      color: '#0284c7',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {note.userId === workOrder.createdById ? 'ADMIN' : 'TECHNICIAN'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {formatDate(note.createdAt)}, {formatTime(note.createdAt)}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                                {note.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                          {t('technician.noNotesYet', { defaultValue: 'No additional notes added yet.' })}
                        </div>
                      )}
                    </div>

                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={t('technician.typeNotePlaceholder', { defaultValue: 'Type a note...' })}
                        disabled={submittingNote}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={submittingNote || !newNote.trim()}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: 'var(--primary-600)',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: submittingNote || !newNote.trim() ? 'not-allowed' : 'pointer',
                          opacity: submittingNote || !newNote.trim() ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Send size={13} />
                        <span>{t('technician.addNoteBtn', { defaultValue: '+ Add Note' })}</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'process' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Process Timing Control Panel (Screenshot 4 & 5) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} />
                  <span>{t('technician.timingPanel.title', { defaultValue: 'PROCESS TIMING CONTROL PANEL' })}</span>
                </div>

                {!myProcess ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('technician.timingPanel.notAssigned', { defaultValue: 'You are not assigned to any step on this Work Order.' })}
                  </div>
                ) : myProcess.status === 'COMPLETED' ? (
                  /* Completed State */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontWeight: 600, fontSize: '14px' }}>
                    <CheckCircle2 size={20} />
                    <span>
                      {t('technician.timingPanel.completedMsg', {
                        defaultValue: 'Completed! Total active time: {{duration}}',
                        duration: formatDurationDisplay(myProcess.totalActiveDuration || 0),
                      })}
                    </span>
                  </div>
                ) : !isReadyToStart ? (
                  /* Locked / Waiting on Prior Step */
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      padding: '14px 18px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    <Lock size={18} style={{ color: '#94a3b8' }} />
                    <span>
                      {t('technician.timingPanel.waitingPrior', {
                        defaultValue: 'Waiting for previous step "{{stepName}}" to be completed before you can start.',
                        stepName: priorProcess?.processName || 'prior step',
                      })}
                    </span>
                  </div>
                ) : myProcess.status === 'NOT_STARTED' ? (
                  /* Ready to Start */
                  <div>
                    <button
                      type="button"
                      onClick={handleStartProcess}
                      disabled={actionLoading}
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        backgroundColor: '#38bdf8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      <Play size={16} />
                      <span>{t('technician.timingPanel.startProcess', { defaultValue: 'Start Process' })}</span>
                    </button>
                  </div>
                ) : myProcess.status === 'IN_PROGRESS' ? (
                  /* In Progress Controls with Live Timer */
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                          {t('technician.timingPanel.inProgress', { defaultValue: 'In Progress' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-heading)' }}>
                        ⏱ {formatDurationDisplay(activeDurationSec)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handlePauseProcess}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          border: '1px solid #fde68a',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Pause size={15} />
                        <span>{t('technician.timingPanel.pause', { defaultValue: 'Pause Process' })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCompleteProcess}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{t('technician.timingPanel.complete', { defaultValue: 'Complete Process' })}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Paused Controls */
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                          {t('technician.timingPanel.paused', { defaultValue: 'Paused' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-heading)' }}>
                        ⏱ {formatDurationDisplay(myProcess.totalActiveDuration || 0)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handleResumeProcess}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: '#38bdf8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Play size={15} />
                        <span>{t('technician.timingPanel.resume', { defaultValue: 'Resume Process' })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCompleteProcess}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{t('technician.timingPanel.complete', { defaultValue: 'Complete Process' })}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Workflow Stepper Sequence (Screenshots 4 & 5) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} />
                  <span>{t('technician.workflowSequence', { defaultValue: 'WORKFLOW STEPPER SEQUENCE' })}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workOrder.processes.map((proc, index) => {
                    const isCompleted = proc.status === 'COMPLETED';
                    const isCurrentActive = proc.status === 'IN_PROGRESS';
                    const isPaused = proc.status === 'PAUSED';
                    const isAssignedToMe = proc.technicianId === user?.id;

                    const priorDone = workOrder.processes
                      .filter((p) => p.sequence < proc.sequence)
                      .every((p) => p.status === 'COMPLETED');
                    const isLocked = !priorDone && !isCompleted;

                    return (
                      <div
                        key={proc.id || index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          backgroundColor: 'var(--bg-surface)',
                          border: `1px solid ${isAssignedToMe ? '#38bdf8' : 'var(--border-subtle)'}`,
                          padding: '14px 16px',
                          borderRadius: '10px',
                        }}
                      >
                        {/* Stepper Node */}
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCompleted
                              ? '#10b981'
                              : isCurrentActive
                              ? '#38bdf8'
                              : isLocked
                              ? 'var(--bg-card)'
                              : '#e2e8f0',
                            color: isCompleted || isCurrentActive ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={16} />
                          ) : isLocked ? (
                            <Lock size={13} />
                          ) : (
                            proc.sequence + 1
                          )}
                        </div>

                        {/* Step Details */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                              {proc.processName}
                            </span>
                            {isAssignedToMe && (
                              <span
                                style={{
                                  backgroundColor: '#d1fae5',
                                  color: '#059669',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                }}
                              >
                                {t('technician.assignedToMe', { defaultValue: 'Assigned to Me' })}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {proc.technician?.name
                              ? `Tech: ${proc.technician.name}`
                              : proc.doctor?.name
                              ? `Doctor: ${proc.doctor.name}`
                              : t('technician.unassigned', { defaultValue: 'Unassigned' })}
                          </div>
                        </div>

                        {/* Step Duration / Status */}
                        {proc.totalActiveDuration && proc.totalActiveDuration > 0 ? (
                          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} />
                            <span>{formatDurationDisplay(proc.totalActiveDuration)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Process Activity & Audit Log (Screenshot 4) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  <span>{t('technician.auditLog.title', { defaultValue: 'PROCESS ACTIVITY & AUDIT LOG' })}</span>
                </div>

                {allActivityLogs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {allActivityLogs.map((log) => {
                      const isComp = log.action === 'COMPLETE';
                      const isPau = log.action === 'PAUSE';
                      const dotColor = isComp ? '#10b981' : isPau ? '#f59e0b' : '#38bdf8';
                      const actionTitle =
                        log.action === 'COMPLETE'
                          ? t('technician.auditLog.processCompleted', { defaultValue: 'Process Completed' })
                          : log.action === 'PAUSE'
                          ? t('technician.auditLog.processPaused', { defaultValue: 'Process Paused' })
                          : log.action === 'RESUME'
                          ? t('technician.auditLog.processResumed', { defaultValue: 'Process Resumed' })
                          : t('technician.auditLog.processStarted', { defaultValue: 'Process Started' });

                      return (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: dotColor,
                              marginTop: '5px',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: dotColor }}>
                                {actionTitle}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {formatTime(log.timestamp)}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '2px' }}>
                              {log.notes || `${log.processName} - ${log.action}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {t('technician.auditLog.noLogsYet', { defaultValue: 'No activity recorded yet for this order.' })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '40px 20px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <MessageSquare size={36} style={{ color: 'var(--primary-400)', margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('technician.chat.title', { defaultValue: 'Order Discussion & Chat' })}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', maxWidth: '360px', marginInline: 'auto' }}>
                {t('technician.chat.desc', {
                  defaultValue: 'Direct messaging with clinic doctors and lab team will be enabled in Phase 2.5 cross-module collaboration.',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Print QR Modal */}
      {isQrModalOpen && (
        <PrintQrModal workOrder={workOrder} onClose={() => setIsQrModalOpen(false)} />
      )}
    </div>
  );
};
