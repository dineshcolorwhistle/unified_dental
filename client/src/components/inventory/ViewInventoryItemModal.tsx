import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Package,
  Calendar,
  Tag,
  Building2,
  User,
  Clock,
  FileText,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  DollarSign,
  Truck,
  Award,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { formatDate, formatDateTime, formatCurrency } from '../../core/utils/dateUtils';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  status: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number | string;
  brand?: string;
  supplier?: string;
  expiryDate?: string;
  description?: string;
  branchId: string;
  categoryId: string;
  moduleKey?: string;
  category?: { id: string; name: string; productType?: string; status?: string };
  branch?: { id: string; name: string; code?: string };
  createdBy?: { id: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

interface ViewInventoryItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  isTenantAdmin: boolean;
}

export const ViewInventoryItemModal: React.FC<ViewInventoryItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  isTenantAdmin,
}) => {
  const { t, i18n } = useTranslation();

  if (!isOpen || !item) return null;

  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';
  const qty = Number(item.quantity) || 0;
  const minQty = Number(item.minQuantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const totalVal = qty * unitPrice;

  // Status Badge Helper
  const getStatusBadge = () => {
    switch (item.status) {
      case 'IN_STOCK':
        return {
          bg: 'var(--badge-success-bg)',
          text: 'var(--badge-success-text)',
          icon: <CheckCircle2 size={13} />,
          label: t('inventory.statusOptions.IN_STOCK'),
        };
      case 'LOW_STOCK':
        return {
          bg: 'var(--badge-warning-bg)',
          text: 'var(--badge-warning-text)',
          icon: <AlertTriangle size={13} />,
          label: t('inventory.statusOptions.LOW_STOCK'),
        };
      case 'OUT_OF_STOCK':
        return {
          bg: 'var(--badge-danger-bg)',
          text: 'var(--badge-danger-text)',
          icon: <AlertTriangle size={13} />,
          label: t('inventory.statusOptions.OUT_OF_STOCK'),
        };
      case 'DISCONTINUED':
      default:
        return {
          bg: 'var(--bg-surface-muted)',
          text: 'var(--text-muted)',
          icon: null,
          label: t('inventory.statusOptions.DISCONTINUED'),
        };
    }
  };

  const statusBadge = getStatusBadge();

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
          maxWidth: '660px',
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
              <Package size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('inventory.modals.viewItemTitle')}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {t('inventory.modals.viewItemSubtitle')}
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

        {/* Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Item Highlight Banner */}
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
                {t('inventory.fields.totalValue')}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                {formatCurrency(totalVal)}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {formatCurrency(unitPrice)} / unit
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {item.sku}
              </span>

              {item.category && (
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
                  <Layers size={13} />
                  <span>{item.category.name}</span>
                </span>
              )}

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: statusBadge.bg,
                  color: statusBadge.text,
                }}
              >
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </span>
            </div>
          </div>

          {/* Title Row */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              {t('inventory.fields.itemName')}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {item.name}
            </div>
          </div>

          {/* Stock Metrics Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Current Quantity */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
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
                <Package size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('inventory.fields.currentQuantity')}
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    marginTop: '2px',
                    color:
                      qty === 0
                        ? 'var(--badge-danger-text)'
                        : qty <= minQty
                        ? 'var(--badge-warning-text)'
                        : 'var(--text-heading)',
                  }}
                >
                  {qty}
                </div>
              </div>
            </div>

            {/* Minimum Quantity */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--badge-warning-text)',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('inventory.fields.minimumQuantity')}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {minQty}
                </div>
              </div>
            </div>

            {/* Unit Price */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0,
                }}
              >
                <DollarSign size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('inventory.fields.unitPrice')}
                </div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {formatCurrency(unitPrice)}
                </div>
              </div>
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
            {/* Brand */}
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
                <Award size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('inventory.fields.brand')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.brand || '—'}
                </div>
              </div>
            </div>

            {/* Supplier */}
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
                <Truck size={16} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('inventory.fields.supplier')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.supplier || '—'}
                </div>
              </div>
            </div>

            {/* Expiry Date */}
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
                  {t('inventory.fields.expiryDate')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.expiryDate ? formatDate(item.expiryDate, { locale }) : '—'}
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
                  {t('inventory.fields.branch')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.branch?.name || '—'}
                  {item.branch?.code && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>
                      ({item.branch.code})
                    </span>
                  )}
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
                  {t('inventory.fields.createdBy')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.createdBy?.name || '—'}
                </div>
                {item.createdBy?.email && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {item.createdBy.email}
                  </div>
                )}
              </div>
            </div>

            {/* Recorded On */}
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
                  {t('inventory.fields.createdAt')}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {item.createdAt ? formatDateTime(item.createdAt, { locale }) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Description Box */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <FileText size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('inventory.fields.description')}
              </span>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                color: item.description ? 'var(--text-main)' : 'var(--text-muted)',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                fontStyle: item.description ? 'normal' : 'italic',
                minHeight: '60px',
              }}
            >
              {item.description || t('inventory.fields.noDescription')}
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-modal, var(--bg-card))',
          }}
        >
          <div>
            {/* Delete Action for Tenant Admin */}
            {isTenantAdmin && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(item);
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
                <span>{t('inventory.deleteModal.titleItem')}</span>
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
              {t('inventory.buttons.cancel')}
            </button>

            {/* Edit Action for Branch Operator */}
            {!isTenantAdmin && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(item);
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
                <span>{t('inventory.editItem')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
