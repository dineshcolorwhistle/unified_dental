import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Receipt,
  Calendar,
  Tag,
  CreditCard,
  Building2,
  User,
  Clock,
  FileText,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { formatDate, formatDateTime, formatCurrency } from '../../core/utils/dateUtils';

export interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number | string;
  expenseDate: string;
  paymentMethod: string;
  branchId: string;
  categoryId: string;
  category?: { id: string; name: string };
  branch?: { id: string; name: string; code?: string };
  createdBy?: { id: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

interface ViewExpenseModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  isTenantAdmin: boolean;
}

export const ViewExpenseModal: React.FC<ViewExpenseModalProps> = ({
  expense,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  isTenantAdmin,
}) => {
  const { t, i18n } = useTranslation();

  if (!isOpen || !expense) return null;

  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
                flexShrink: 0,
              }}
            >
              <Receipt size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('expenses.modals.viewExpenseTitle')}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {t('expenses.modals.viewExpenseSubtitle')}
              </p>
            </div>
          </div>
          <Tooltip content={t('common.close', 'Close')}>
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
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Highlight Hero Card */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('expenses.fields.amount')}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                {formatCurrency(expense.amount)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--badge-primary-bg)',
                  color: 'var(--primary-600)',
                }}
              >
                <Tag size={13} />
                <span>{expense.category?.name || '—'}</span>
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--blue-500)',
                }}
              >
                <CreditCard size={13} />
                <span>{expense.paymentMethod}</span>
              </span>
            </div>
          </div>

          {/* Title Row */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              {t('expenses.fields.title')}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {expense.title}
            </div>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Expense Date */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600)',
                  flexShrink: 0,
                }}
              >
                <Calendar size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('expenses.fields.date')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {formatDate(expense.expenseDate, { locale })}
                </div>
              </div>
            </div>

            {/* Branch */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600)',
                  flexShrink: 0,
                }}
              >
                <Building2 size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('expenses.fields.branch')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {expense.branch?.name || '—'}
                  {expense.branch?.code ? (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>
                      ({expense.branch.code})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Recorded By */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600)',
                  flexShrink: 0,
                }}
              >
                <User size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('expenses.fields.createdBy')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {expense.createdBy?.name || '—'}
                </div>
                {expense.createdBy?.email && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {expense.createdBy.email}
                  </div>
                )}
              </div>
            </div>

            {/* Recorded On (Timestamp) */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600)',
                  flexShrink: 0,
                }}
              >
                <Clock size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('expenses.fields.createdAt')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {expense.createdAt ? formatDateTime(expense.createdAt, { locale }) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Description / Notes Box */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <FileText size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('expenses.fields.description')}
              </span>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                color: expense.description ? 'var(--text-main)' : 'var(--text-muted)',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                fontStyle: expense.description ? 'normal' : 'italic',
                minHeight: '60px',
              }}
            >
              {expense.description || t('expenses.noDescription')}
            </div>
          </div>
        </div>

        {/* Footer / Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div>
            {/* Destructive Delete Action for Tenant Admin */}
            {isTenantAdmin && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(expense);
                }}
                className="btn btn-danger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <Trash2 size={14} />
                <span>{t('expenses.deleteModal.titleExpense')}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {t('expenses.buttons.cancel')}
            </button>

            {/* Edit Action for Lab Admin */}
            {!isTenantAdmin && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(expense);
                }}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <Edit2 size={14} />
                <span>{t('expenses.editExpense')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
