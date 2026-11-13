import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Package,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { Tooltip } from '../common/Tooltip';
import { InventoryItem } from './ViewInventoryItemModal';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onStockAdded: (updatedItem: InventoryItem) => void;
}

export const AddStockModal: React.FC<AddStockModalProps> = ({
  isOpen,
  onClose,
  item,
  onStockAdded,
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity('1');
      setReason('');
      setLoading(false);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const currentQty = Number(item.quantity) || 0;
  const minQty = Number(item.minQuantity) || 0;
  const parsedAddQty = parseInt(quantity, 10);
  const validAddQty = !isNaN(parsedAddQty) && parsedAddQty > 0 ? parsedAddQty : 0;
  const newCalculatedQty = currentQty + validAddQty;

  const isDiscontinued = item.status === 'DISCONTINUED';
  const newCalculatedStatus = isDiscontinued
    ? 'DISCONTINUED'
    : newCalculatedQty <= 0
    ? 'OUT_OF_STOCK'
    : newCalculatedQty <= minQty
    ? 'LOW_STOCK'
    : 'IN_STOCK';

  const willBeInStock = newCalculatedStatus === 'IN_STOCK';

  const handleQuickAdd = (amount: number) => {
    const current = parseInt(quantity, 10) || 0;
    setQuantity(String(Math.max(1, current + amount)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validAddQty <= 0) {
      toast.error(t('inventory.toast.invalidQuantity', 'Please enter a valid stock quantity greater than 0.'));
      return;
    }

    try {
      setLoading(true);
      const res = await api.post(`/inventory/items/${item.id}/add-stock`, {
        quantity: validAddQty,
        reason: reason.trim() || undefined,
      });

      const updated = res.data?.item || res.data;
      toast.success(t('inventory.toast.stockAdded', 'Stock added successfully.'));
      onStockAdded(updated);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('inventory.toast.errorAddStock', 'Failed to add stock.');
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
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
        zIndex: 1060,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
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
        {/* Modal Header */}
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
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-success-bg, #ecfdf5)',
                color: 'var(--badge-success-text, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Plus size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('inventory.modals.addStockTitle', 'Add Stock')}
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                {t('inventory.modals.addStockSubtitle', 'Increase available stock count for this inventory item')}
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Item Identification Card */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {item.sku}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor:
                      item.status === 'LOW_STOCK'
                        ? 'var(--badge-warning-bg)'
                        : item.status === 'OUT_OF_STOCK'
                        ? 'var(--badge-danger-bg)'
                        : 'var(--badge-success-bg)',
                    color:
                      item.status === 'LOW_STOCK'
                        ? 'var(--badge-warning-text)'
                        : item.status === 'OUT_OF_STOCK'
                        ? 'var(--badge-danger-text)'
                        : 'var(--badge-success-text)',
                  }}
                >
                  {t(`inventory.statusOptions.${item.status}`, item.status)}
                </span>
              </div>
            </div>

            {/* Current vs New Quantity Preview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '8px',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-muted, rgba(0,0,0,0.02))',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('inventory.fields.currentStock', 'Current Stock')}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {currentQty}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Min: {minQty}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                <ArrowRight size={20} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('inventory.fields.newCalculatedStock', 'New Total')}
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color:
                      newCalculatedStatus === 'DISCONTINUED'
                        ? 'var(--text-muted)'
                        : newCalculatedStatus === 'OUT_OF_STOCK'
                        ? 'var(--badge-danger-text, #ef4444)'
                        : willBeInStock
                        ? 'var(--badge-success-text, #059669)'
                        : 'var(--badge-warning-text, #d97706)',
                    marginTop: '2px',
                  }}
                >
                  {newCalculatedQty}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color:
                      newCalculatedStatus === 'DISCONTINUED'
                        ? 'var(--text-muted)'
                        : newCalculatedStatus === 'OUT_OF_STOCK'
                        ? 'var(--badge-danger-text, #ef4444)'
                        : willBeInStock
                        ? 'var(--badge-success-text, #059669)'
                        : 'var(--badge-warning-text, #d97706)',
                  }}
                >
                  {t(`inventory.statusOptions.${newCalculatedStatus}`, newCalculatedStatus)}
                </div>
              </div>
            </div>

            {/* Quantity Input Field */}
            <div>
              <label
                htmlFor="add-quantity-input"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--text-heading)',
                  marginBottom: '6px',
                }}
              >
                {t('inventory.fields.additionalQuantity', 'Quantity to Add')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="add-quantity-input"
                type="number"
                min="1"
                step="1"
                autoFocus
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '16px',
                  fontWeight: 700,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  height: '44px',
                }}
              />

              {/* Quick Increment Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {t('common.quickAdd', 'Quick add')}:
                </span>
                {[5, 10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAdd(amt)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-heading)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason / Notes */}
            <div>
              <label
                htmlFor="add-reason-input"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--text-heading)',
                  marginBottom: '6px',
                }}
              >
                {t('inventory.fields.reasonOrNotes', 'Reason or Notes')} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
              </label>
              <input
                id="add-reason-input"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('inventory.placeholders.addReason', 'e.g. Weekly restock order, delivery from vendor')}
                className="form-control"
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  height: '42px',
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                minHeight: '40px',
              }}
            >
              {t('common.cancel', 'Cancel')}
            </button>

            <button
              type="submit"
              disabled={loading || validAddQty <= 0}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                minHeight: '40px',
                backgroundColor: 'var(--primary-600)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || validAddQty <= 0 ? 'not-allowed' : 'pointer',
                opacity: loading || validAddQty <= 0 ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>{t('common.saving', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>{t('inventory.buttons.confirmAddStock', 'Add to Stock')} (+{validAddQty})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

