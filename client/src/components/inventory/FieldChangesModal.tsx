import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, History } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { formatDateTime } from '../../core/utils/dateUtils';
import { InventoryItem } from './ViewInventoryItemModal';
import { InventoryActivityRecord } from './InventoryActivityModal';

interface FieldChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  activity: InventoryActivityRecord | null;
}

export const FieldChangesModal: React.FC<FieldChangesModalProps> = ({
  isOpen,
  onClose,
  item,
  activity,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  if (!isOpen || !activity || !item) return null;

  const userName = activity.user?.name || t('common.systemUser', 'System / Unknown');
  const changes = activity.changes || {};
  const changeEntries = Object.entries(changes).filter(
    ([_, diff]) => diff && (diff.old !== undefined || diff.new !== undefined) && diff.old !== diff.new
  );

  // Stock movement value calculation
  const stockMovement =
    activity.quantityChanged !== null && activity.quantityChanged !== undefined
      ? Number(activity.quantityChanged) > 0
        ? `+${activity.quantityChanged}`
        : `${activity.quantityChanged}`
      : null;

  // Field label mapping
  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'quantity':
        return t('inventory.fields.currentQuantity', 'Current Quantity');
      case 'unitPrice':
        return t('inventory.fields.unitPrice', 'Unit Price');
      case 'minQuantity':
        return t('inventory.fields.minimumQuantity', 'Minimum Quantity');
      case 'name':
        return t('inventory.fields.itemName', 'Item Name');
      case 'sku':
        return t('inventory.fields.sku', 'SKU / Code');
      case 'brand':
        return t('inventory.fields.brand', 'Brand');
      case 'supplier':
        return t('inventory.fields.supplier', 'Supplier');
      case 'expiryDate':
        return t('inventory.fields.expiryDate', 'Expiry Date');
      case 'categoryId':
        return t('inventory.fields.category', 'Category');
      case 'description':
        return t('inventory.fields.description', 'Description');
      case 'status':
        return t('inventory.fields.status', 'Status');
      default:
        return t(`inventory.fields.${field}`, field);
    }
  };

  const formatFieldValue = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return '—';
    }
    if (typeof val === 'boolean') {
      return val ? t('common.yes', 'Yes') : t('common.no', 'No');
    }
    return String(val);
  };

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
        zIndex: 1070,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
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
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg, #eff6ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600, #2563eb)',
                flexShrink: 0,
              }}
            >
              <History size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('inventory.modals.fieldChangesTitle', 'Field Changes & Details')}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                {item.name} ({item.sku})
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

        {/* Content Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Activity Summary Info Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface, #f8fafc)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('inventory.fields.action', 'Action')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
                {activity.action}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('inventory.fields.performedBy', 'Performed By')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
                {userName}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('inventory.fields.dateTime', 'Date & Time')}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
                {formatDateTime(activity.createdAt, { locale })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('inventory.fields.stockMovement', 'Stock Movement')}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  marginTop: '4px',
                  color: stockMovement
                    ? Number(activity.quantityChanged) > 0
                      ? 'var(--badge-success-text, #059669)'
                      : 'var(--badge-danger-text, #dc2626)'
                    : 'var(--text-muted)',
                }}
              >
                {stockMovement || '—'}
              </div>
            </div>
          </div>

          {/* Adjustment Reason / Notes */}
          {activity.reason && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface, #f8fafc)',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-heading)', marginRight: '6px' }}>
                {t('inventory.fields.reasonOrNotes', 'Reason')}:
              </span>
              <span style={{ color: 'var(--text-main)' }}>{activity.reason}</span>
            </div>
          )}

          {/* Modified Fields Section */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 12px 0' }}>
              {t('inventory.modals.modifiedFields', 'Modified Fields')}
            </h3>

            {changeEntries.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                {t('inventory.modals.noFieldChanges', 'No field modifications recorded for this activity.')}
              </div>
            ) : (
              <div
                style={{
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--bg-surface, #f8fafc)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <th
                          style={{
                            padding: '10px 16px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            width: '40%',
                          }}
                        >
                          {t('inventory.fields.field', 'Field')}
                        </th>
                        <th
                          style={{
                            padding: '10px 16px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            width: '30%',
                          }}
                        >
                          {t('inventory.fields.previousValue', 'Previous Value')}
                        </th>
                        <th
                          style={{
                            padding: '10px 16px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            width: '30%',
                          }}
                        >
                          {t('inventory.fields.updatedValue', 'Updated Value')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeEntries.map(([fieldKey, diff], idx) => (
                        <tr
                          key={fieldKey}
                          style={{
                            borderBottom: idx < changeEntries.length - 1 ? '1px solid var(--border-color)' : 'none',
                            backgroundColor: 'var(--bg-card)',
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {getFieldLabel(fieldKey)}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 600 }}>
                            {formatFieldValue(diff?.old)}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>
                            {formatFieldValue(diff?.new)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-modal, var(--bg-card))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
            }}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
