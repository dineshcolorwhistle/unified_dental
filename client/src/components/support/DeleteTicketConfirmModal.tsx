import React, { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { supportService, SupportTicket } from '../../services/supportService';

interface DeleteTicketConfirmModalProps {
  isOpen: boolean;
  ticket: SupportTicket | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export const DeleteTicketConfirmModal: React.FC<DeleteTicketConfirmModalProps> = ({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !ticket) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await supportService.deleteTicket(ticket.id);
      toast.success(t('support.deleteSuccess', 'Support ticket deleted successfully.'));
      onSuccess(ticket.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete ticket:', err);
      toast.error(err?.response?.data?.message || t('support.deleteError', 'Failed to delete support ticket.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '460px',
          width: '92%',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('support.deleteTicketTitle', 'Delete Support Ticket')}?
        </h3>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          {t(
            'support.deleteTicketWarning',
            'Are you sure you want to delete this ticket? This will permanently delete ticket',
          )}{' '}
          <strong style={{ color: 'var(--text-primary)' }}>#{ticket.ticketNumber} ({ticket.title})</strong>{' '}
          {t('support.deleteTicketWarningFollowup', 'and all its conversation history. This action cannot be undone.')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isDeleting && <Loader2 size={16} className="spin" />}
            {t('common.delete', 'Delete Ticket')}
          </button>
        </div>
      </div>
    </div>
  );
};
