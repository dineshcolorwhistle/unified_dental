import React, { useState } from 'react';
import { X, Send, MessageSquare, Clock, User, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
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
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !workOrder) return null;

  const notesList: WorkOrderNoteItem[] = workOrder.notesHistory || [];

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newNote.trim();
    if (!val) return;

    setSubmitting(true);
    try {
      await workOrderService.addNote(workOrder.id, val);
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
            notesList.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    <User size={13} style={{ color: 'var(--primary-600)' }} />
                    <span>{item.user?.name || 'User'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <Clock size={11} />
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
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
              </div>
            ))
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
    </div>
  );
};
