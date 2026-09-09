import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Clock, User, Loader2, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { Tooltip } from '../common/Tooltip';
import { workOrderService, WorkOrderListItem, WorkOrderNoteItem } from '../../services/workOrderService';
import { formatDateTime } from '../../core/utils/dateUtils';

interface WorkOrderNotesModalProps {
  workOrder: WorkOrderListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
}

export const WorkOrderNotesModal: React.FC<WorkOrderNotesModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onNoteAdded,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();
  const isAdmin = Boolean(isTenantAdmin || isLabAdmin || user?.isSuperAdmin);

  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localNotes, setLocalNotes] = useState<WorkOrderNoteItem[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<WorkOrderNoteItem | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  useEffect(() => {
    if (workOrder) {
      setLocalNotes((workOrder.notesHistory as WorkOrderNoteItem[]) || []);
      setNewNote('');
      setEditingNoteId(null);
      setEditingNoteText('');
      setNoteToDelete(null);
    }
  }, [workOrder]);

  if (!isOpen || !workOrder) return null;

  const notesList: WorkOrderNoteItem[] = localNotes;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newNote.trim();
    if (!val) return;

    setSubmitting(true);
    try {
      const created = await workOrderService.addNote(workOrder.id, val);
      setLocalNotes((prev) => [created, ...prev]);
      toast.success(t('workOrders.notesModal.addSuccess', 'Note added successfully'));
      setNewNote('');
      onNoteAdded();
    } catch (err: any) {
      console.error('Failed to add note', err);
      toast.error(err?.response?.data?.message || t('workOrders.notesModal.addFailed', 'Failed to add note'));
    } finally {
      setSubmitting(false);
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
      onNoteAdded();
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
      onNoteAdded();
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
          maxWidth: '560px',
          width: '95%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('workOrders.notesModal.title', 'Notes & History')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('workOrders.folio', 'Folio')}:{' '}
                <strong style={{ color: 'var(--text-heading)' }}>{workOrder.folioNumber}</strong>
                {workOrder.patient && ` • ${workOrder.patient}`}
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
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Notes List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '200px',
            maxHeight: '400px',
          }}
        >
          {notesList.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>
                {t('workOrders.notesModal.empty', 'No notes recorded yet for this work order.')}
              </p>
            </div>
          ) : (
            notesList.map((item) => {
              const isAuthor = item.userId === user?.id || (item.user && item.user.id === user?.id);
              const canEditOrDelete = isAdmin || isAuthor;
              const isEditing = editingNoteId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
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
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      <User size={13} style={{ color: 'var(--primary-600)' }} />
                      <span>{item.user?.name || t('common.user', 'User')}</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        <Clock size={11} />
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
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
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.note}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Note Form */}
        <form
          onSubmit={handleAddNote}
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            className="form-input"
            placeholder={t('workOrders.notesModal.inputPlaceholder', 'Write a note or update for this order...')}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !newNote.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              height: '38px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {submitting ? (
              <Loader2 size={15} className="spinner" />
            ) : (
              <>
                <Send size={14} />
                <span>{t('common.add', 'Add')}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Sleek Delete Note Confirmation Modal */}
      {noteToDelete && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '400px',
              width: '90%',
              padding: '24px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
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
