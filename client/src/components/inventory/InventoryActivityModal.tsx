import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  History,
  Package,
  Plus,
  RefreshCw,
  PlusCircle,
  Edit2,
  Sliders,
  Calendar,
  User,
  ArrowRight,
  Filter,
  Layers,
  Clock,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { Tooltip } from '../common/Tooltip';
import { Pagination } from '../common/Pagination';
import { formatDateTime } from '../../core/utils/dateUtils';
import { InventoryItem } from './ViewInventoryItemModal';

export interface InventoryActivityRecord {
  id: string;
  tenantId: string;
  itemId: string;
  userId?: string | null;
  action: 'CREATED' | 'MODIFIED' | 'STOCK_ADDED' | 'STOCK_ADJUSTED' | string;
  quantityChanged?: number | null;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  reason?: string | null;
  changes?: Record<string, { old?: any; new?: any }> | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface InventoryActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onOpenAddStock?: (item: InventoryItem) => void;
}

export const InventoryActivityModal: React.FC<InventoryActivityModalProps> = ({
  isOpen,
  onClose,
  item,
  onOpenAddStock,
}) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const [activities, setActivities] = useState<InventoryActivityRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  const fetchActivities = useCallback(async () => {
    if (!item?.id) return;
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };
      if (selectedAction !== 'all') {
        params.action = selectedAction;
      }

      const res = await api.get(`/inventory/items/${item.id}/activities`, { params });
      setActivities(res.data?.activities || []);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalItems(res.data.pagination.totalItems || 0);
      }
    } catch (err: any) {
      toast.error(t('inventory.toast.errorLoadActivities', 'Failed to load activity history.'));
    } finally {
      setLoading(false);
    }
  }, [item?.id, page, pageSize, selectedAction, t, toast]);

  useEffect(() => {
    if (isOpen && item?.id) {
      setPage(1);
      fetchActivities();
    }
  }, [isOpen, item?.id, selectedAction]);

  useEffect(() => {
    if (isOpen && item?.id) {
      fetchActivities();
    }
  }, [page, pageSize]);

  if (!isOpen || !item) return null;

  // Filter Action Options
  const actionFilterOptions = [
    { value: 'all', label: t('inventory.activities.filterAll', 'All Activities') },
    { value: 'STOCK_ADDED', label: t('inventory.activities.filterStockAdded', 'Stock Added') },
    { value: 'STOCK_ADJUSTED', label: t('inventory.activities.filterStockAdjusted', 'Stock Adjustments') },
    { value: 'MODIFIED', label: t('inventory.activities.filterModified', 'Modified') },
    { value: 'CREATED', label: t('inventory.activities.filterCreated', 'Created') },
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'STOCK_ADDED':
        return {
          icon: <Plus size={14} />,
          label: t('inventory.activities.actions.STOCK_ADDED', 'Stock Added'),
          bg: 'var(--badge-success-bg, #ecfdf5)',
          text: 'var(--badge-success-text, #059669)',
          border: '1px solid var(--badge-success-border, #a7f3d0)',
        };
      case 'STOCK_ADJUSTED':
        return {
          icon: <Sliders size={14} />,
          label: t('inventory.activities.actions.STOCK_ADJUSTED', 'Stock Adjusted'),
          bg: 'var(--badge-warning-bg, #fffbeb)',
          text: 'var(--badge-warning-text, #d97706)',
          border: '1px solid var(--badge-warning-border, #fde68a)',
        };
      case 'MODIFIED':
        return {
          icon: <Edit2 size={14} />,
          label: t('inventory.activities.actions.MODIFIED', 'Item Modified'),
          bg: 'var(--badge-primary-bg, #eff6ff)',
          text: 'var(--primary-600, #2563eb)',
          border: '1px solid var(--badge-primary-border, #bfdbfe)',
        };
      case 'CREATED':
      default:
        return {
          icon: <PlusCircle size={14} />,
          label: t('inventory.activities.actions.CREATED', 'Item Created'),
          bg: 'var(--badge-info-bg, #f0fdfa)',
          text: 'var(--badge-info-text, #0d9488)',
          border: '1px solid var(--badge-info-border, #99f6e4)',
        };
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
          maxWidth: '780px',
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
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
                flexShrink: 0,
              }}
            >
              <History size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('inventory.modals.activityModalTitle', 'Activity History & Audit Log')}
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                {t('inventory.modals.activityModalSubtitle', 'Complete chronological record of all changes, stock additions, and adjustments')}
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

        {/* Item Summary Bar */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={18} style={{ color: 'var(--primary-600)' }} />
            <div>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {item.name}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  marginLeft: '8px',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-card)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {item.sku}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('inventory.fields.currentStock', 'Current Stock')}:{' '}
              <strong style={{ color: 'var(--text-heading)', fontSize: '14px' }}>{item.quantity}</strong> (Min: {item.minQuantity})
            </div>

            {onOpenAddStock && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddStock(item);
                }}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                <Plus size={14} />
                <span>{t('inventory.buttons.addStock', 'Add Stock')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Filters Bar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Filter size={13} />
            <span>{t('common.filter', 'Filter')}:</span>
          </span>

          {actionFilterOptions.map((opt) => {
            const isActive = selectedAction === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSelectedAction(opt.value);
                  setPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: isActive ? '1px solid var(--primary-600)' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--badge-primary-bg)' : 'var(--bg-card)',
                  color: isActive ? 'var(--primary-600)' : 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Activity Timeline List (Scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <RefreshCw size={20} className="animate-spin" />
                <span>{t('common.loading', 'Loading activities...')}</span>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  margin: '0 auto 12px auto',
                }}
              >
                <History size={24} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('inventory.activities.noActivities', 'No activity history found.')}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {t('inventory.activities.noActivitiesDesc', 'No transactions or changes match the selected filter.')}
              </p>
            </div>
          ) : (
            activities.map((act) => {
              const badge = getActionBadge(act.action);
              const userName = act.user?.name || t('common.systemUser', 'System / Unknown');
              const userEmail = act.user?.email;

              return (
                <div
                  key={act.id}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Top Bar: Action Badge + Performed By + Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: badge.border,
                        }}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      {/* Stock Quantity Delta Badge */}
                      {act.action === 'STOCK_ADDED' && act.quantityChanged !== null && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--badge-success-bg, #ecfdf5)',
                            color: 'var(--badge-success-text, #059669)',
                          }}
                        >
                          +{act.quantityChanged} {t('inventory.fields.itemsCount', 'Items')}
                        </span>
                      )}

                      {act.action === 'STOCK_ADJUSTED' && act.quantityChanged !== null && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor:
                              Number(act.quantityChanged) >= 0
                                ? 'var(--badge-success-bg, #ecfdf5)'
                                : 'var(--badge-danger-bg, #fef2f2)',
                            color:
                              Number(act.quantityChanged) >= 0
                                ? 'var(--badge-success-text, #059669)'
                                : 'var(--badge-danger-text, #dc2626)',
                          }}
                        >
                          {Number(act.quantityChanged) > 0 ? `+${act.quantityChanged}` : act.quantityChanged}{' '}
                          {t('inventory.fields.itemsCount', 'Items')}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Clock size={13} />
                      <span>{formatDateTime(act.createdAt, { locale })}</span>
                    </div>
                  </div>

                  {/* Performed By User Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-heading)' }}>{userName}</strong>
                      {userEmail && <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11.5px' }}>({userEmail})</span>}
                    </div>
                  </div>

                  {/* Stock Details & Reason */}
                  {(act.action === 'STOCK_ADDED' || act.action === 'STOCK_ADJUSTED') && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        fontSize: '12.5px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('inventory.fields.stockLevel', 'Stock Level')}:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{act.previousQuantity ?? 0}</span>
                        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 800, color: 'var(--primary-600)' }}>{act.newQuantity ?? 0}</span>
                      </div>

                      {act.reason && (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                          &ldquo;{act.reason}&rdquo;
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modified Fields Comparison Grid */}
                  {act.action === 'MODIFIED' && act.changes && Object.keys(act.changes).length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('inventory.fields.changes', 'Changes')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.entries(act.changes).map(([fieldName, diff]) => (
                          <div
                            key={fieldName}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12.5px',
                              padding: '2px 0',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {t(`inventory.fields.${fieldName}`, fieldName)}:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--danger)', textDecoration: 'line-through', fontSize: '12px' }}>
                                {diff?.old !== undefined && diff?.old !== null ? String(diff.old) : '—'}
                              </span>
                              <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ color: 'var(--badge-success-text, #059669)', fontWeight: 700, fontSize: '12px' }}>
                                {diff?.new !== undefined && diff?.new !== null ? String(diff.new) : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Created Details */}
                  {act.action === 'CREATED' && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        fontSize: '12.5px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        {t('inventory.fields.initialStock', 'Initial stock')}:{' '}
                        <strong style={{ color: 'var(--text-heading)' }}>{act.newQuantity ?? 0}</strong>
                      </span>
                      {act.reason && <span style={{ marginLeft: '12px', fontStyle: 'italic' }}>({act.reason})</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer with Pagination (Rule 11) */}
        {totalItems > 0 && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
            }}
          >
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

