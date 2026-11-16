import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Package,
  Calendar,
  Building2,
  User,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Truck,
  Award,
  Plus,
  History,
  Layers,
  RefreshCw,
  Sliders,
  PlusCircle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { Tooltip } from '../common/Tooltip';
import { Pagination } from '../common/Pagination';
import { formatDate, formatDateTime, formatCurrency } from '../../core/utils/dateUtils';
import { FieldChangesModal } from './FieldChangesModal';

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

export interface InventoryActivityRecord {
  id: string;
  tenantId: string;
  itemId: string;
  userId?: string | null;
  action: 'CREATED' | 'MODIFIED' | 'ITEM_UPDATED' | 'STOCK_ADDED' | 'STOCK_ADJUSTED' | string;
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

interface ViewInventoryItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  onAddStock?: (item: InventoryItem) => void;
  onViewHistory?: (item: InventoryItem) => void;
  initialTab?: 'overview' | 'history';
  isTenantAdmin: boolean;
}

export const ViewInventoryItemModal: React.FC<ViewInventoryItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAddStock,
  onViewHistory,
  initialTab = 'overview',
  isTenantAdmin,
}) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const [activeTab, setActiveTab] = useState<'overview' | 'history'>(initialTab);

  // Activity History State
  const [activities, setActivities] = useState<InventoryActivityRecord[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Field Changes Diff Modal State
  const [selectedActivityForChanges, setSelectedActivityForChanges] =
    useState<InventoryActivityRecord | null>(null);

  // Sync initial tab when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, item?.id]);

  // Fetch activities when history tab is active
  const fetchActivities = useCallback(async () => {
    if (!item?.id) return;
    try {
      setLoadingActivities(true);
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };

      const res = await api.get(`/inventory/items/${item.id}/activities`, { params });
      setActivities(res.data?.activities || []);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalItems(res.data.pagination.totalItems || 0);
      }
    } catch (err: any) {
      toast.error(t('inventory.toast.errorLoadActivities', 'Failed to load activity history.'));
    } finally {
      setLoadingActivities(false);
    }
  }, [item?.id, page, pageSize, t, toast]);

  useEffect(() => {
    if (isOpen && activeTab === 'history' && item?.id) {
      fetchActivities();
    }
  }, [isOpen, activeTab, item?.id, page, pageSize, fetchActivities]);

  if (!isOpen || !item) return null;

  const qty = Number(item.quantity) || 0;
  const minQty = Number(item.minQuantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;

  // Status Badge Helper
  const getStatusBadge = () => {
    switch (item.status) {
      case 'IN_STOCK':
        return {
          bg: '#ecfdf5',
          text: '#059669',
          border: '1px solid #a7f3d0',
          label: t('inventory.statusOptions.IN_STOCK', 'In Stock'),
        };
      case 'LOW_STOCK':
        return {
          bg: '#fffbeb',
          text: '#d97706',
          border: '1px solid #fde68a',
          label: t('inventory.statusOptions.LOW_STOCK', 'Low Stock'),
        };
      case 'OUT_OF_STOCK':
        return {
          bg: '#fef2f2',
          text: '#dc2626',
          border: '1px solid #fecaca',
          label: t('inventory.statusOptions.OUT_OF_STOCK', 'Out of Stock'),
        };
      case 'DISCONTINUED':
      default:
        return {
          bg: '#f1f5f9',
          text: '#64748b',
          border: '1px solid #e2e8f0',
          label: t('inventory.statusOptions.DISCONTINUED', 'Discontinued'),
        };
    }
  };

  const statusBadge = getStatusBadge();

  // Activity Action Badge Helper
  const getActivityActionBadge = (action: string) => {
    switch (action) {
      case 'ITEM_UPDATED':
      case 'MODIFIED':
        return {
          label: t('inventory.activities.actions.ITEM_UPDATED', 'Edited'),
          bg: '#eff6ff',
          text: '#2563eb',
          border: '1px solid #bfdbfe',
        };
      case 'STOCK_ADDED':
        return {
          label: t('inventory.activities.actions.STOCK_ADDED', 'Stock Added'),
          bg: '#ecfdf5',
          text: '#059669',
          border: '1px solid #a7f3d0',
        };
      case 'STOCK_ADJUSTED':
        return {
          label: t('inventory.activities.actions.STOCK_ADJUSTED', 'Stock Adjusted'),
          bg: '#fffbeb',
          text: '#d97706',
          border: '1px solid #fde68a',
        };
      case 'CREATED':
      default:
        return {
          label: t('inventory.activities.actions.CREATED', 'Created'),
          bg: '#f0fdfa',
          text: '#0d9488',
          border: '1px solid #99f6e4',
        };
    }
  };

  return (
    <>
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
            maxWidth: '680px',
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
              padding: '18px 24px 14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-primary-bg, #eff6ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-600, #2563eb)',
                  flexShrink: 0,
                }}
              >
                <Package size={20} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('inventory.modals.viewItemTitle', 'Item Details')}
              </h2>
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

          {/* Tab Navigation */}
          <div
            style={{
              padding: '0 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                fontSize: '14px',
                fontWeight: activeTab === 'overview' ? 700 : 500,
                color: activeTab === 'overview' ? 'var(--primary-600, #2563eb)' : 'var(--text-muted)',
                borderBottom: activeTab === 'overview' ? '2px solid var(--primary-600, #2563eb)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('inventory.tabs.overview', 'Overview')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                fontSize: '14px',
                fontWeight: activeTab === 'history' ? 700 : 500,
                color: activeTab === 'history' ? 'var(--primary-600, #2563eb)' : 'var(--text-muted)',
                borderBottom: activeTab === 'history' ? '2px solid var(--primary-600, #2563eb)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <History size={16} />
              <span>{t('inventory.tabs.auditHistory', 'Audit & Stock History')}</span>
            </button>
          </div>

          {/* Scrollable Modal Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {activeTab === 'overview' ? (
              <>
                {/* 1. Item Header Card */}
                <div
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                        margin: '0 0 10px 0',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.name}
                    </h3>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface, #f8fafc)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {item.sku}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: statusBadge.bg,
                      color: statusBadge.text,
                      border: statusBadge.border,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* 2. Stock Metrics Grid */}
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
                      padding: '16px 18px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t('inventory.fields.currentQuantity', 'Current Quantity')}
                    </div>
                    <div
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: 'var(--text-heading)',
                        marginTop: '6px',
                      }}
                    >
                      {qty}
                    </div>
                  </div>

                  {/* Minimum Quantity */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t('inventory.fields.minimumQuantity', 'Minimum Quantity')}
                    </div>
                    <div
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: 'var(--text-heading)',
                        marginTop: '6px',
                      }}
                    >
                      {minQty}
                    </div>
                  </div>

                  {/* Unit Price */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t('inventory.fields.unitPrice', 'Unit Price')}
                    </div>
                    <div
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: 'var(--primary-600, #2563eb)',
                        marginTop: '6px',
                      }}
                    >
                      {formatCurrency(unitPrice)}
                    </div>
                  </div>
                </div>

                {/* 3. Specifications Card */}
                <div
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {/* Category */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('inventory.fields.category', 'Category')}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '3px' }}>
                      {item.category?.name || '—'}
                      {item.category?.productType && (
                        <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({item.category.productType})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Supplier */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('inventory.fields.supplier', 'Supplier')}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '3px' }}>
                      {item.supplier || '—'}
                    </div>
                  </div>

                  {/* Brand */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('inventory.fields.brand', 'Brand')}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '3px' }}>
                      {item.brand || '—'}
                    </div>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('inventory.fields.expiryDate', 'Expiry Date')}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '3px' }}>
                      {item.expiryDate ? formatDate(item.expiryDate, { locale }) : '—'}
                    </div>
                  </div>

                  {/* Description (if present) */}
                  {item.description && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('inventory.fields.description', 'Description')}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          marginTop: '4px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.description}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Activity Cards List */}
                {loadingActivities ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>{t('common.loading', 'Loading activities...')}</span>
                    </div>
                  </div>
                ) : activities.length === 0 ? (
                  <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        margin: '0 auto 12px auto',
                      }}
                    >
                      <History size={22} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('inventory.activities.noActivities', 'No activity history found.')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {t('inventory.activities.noActivitiesDesc', 'No activity history recorded yet for this item.')}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: '380px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      paddingRight: '4px',
                    }}
                  >
                    {activities.map((act) => {
                      const badge = getActivityActionBadge(act.action);
                      const userName = act.user?.name || t('common.systemUser', 'System / Unknown');
                      const userEmail = act.user?.email;
                      const hasStockMovement = act.quantityChanged !== null && act.quantityChanged !== undefined;
                      const isCreation = act.action === 'CREATED';
                      const validChanges = Object.entries(act.changes || {}).filter(
                        ([_, diff]) => diff && (diff.old !== undefined || diff.new !== undefined) && diff.old !== diff.new
                      );
                      const hasActualFieldChanges = !isCreation && validChanges.length > 0;

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
                          {/* Row 1: Action Badge + Stock Movement Badge + Date & Time */}
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
                              {/* Action Badge */}
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor: badge.bg,
                                  color: badge.text,
                                  border: badge.border,
                                }}
                              >
                                {badge.label}
                              </span>

                              {/* Stock Movement Badge */}
                              {hasStockMovement && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    backgroundColor:
                                      Number(act.quantityChanged) >= 0 ? '#ecfdf5' : '#fef2f2',
                                    color:
                                      Number(act.quantityChanged) >= 0 ? '#059669' : '#dc2626',
                                    border:
                                      Number(act.quantityChanged) >= 0
                                        ? '1px solid #a7f3d0'
                                        : '1px solid #fecaca',
                                  }}
                                >
                                  {Number(act.quantityChanged) > 0 ? `+${act.quantityChanged}` : act.quantityChanged}
                                </span>
                              )}
                            </div>

                            {/* Date & Time */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12.5px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <Clock size={13} />
                              <span>{formatDateTime(act.createdAt, { locale })}</span>
                            </div>
                          </div>

                          {/* Row 2: User details & View Changes Button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13px',
                                color: 'var(--text-main)',
                              }}
                            >
                              <User size={15} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{userName}</span>
                              {userEmail && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  ({userEmail})
                                </span>
                              )}
                            </div>

                            {hasActualFieldChanges && (
                              <button
                                type="button"
                                onClick={() => setSelectedActivityForChanges(act)}
                                style={{
                                  backgroundColor: 'var(--bg-surface, #f1f5f9)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '20px',
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: 'var(--text-heading)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {t('inventory.buttons.viewChangesWithCount', 'View Changes ({{count}})', {
                                  count: validChanges.length,
                                })}
                              </button>
                            )}
                          </div>

                          {/* Row 3: Description / Reason text */}
                          {act.reason && (
                            <div
                              style={{
                                fontSize: '13px',
                                color: 'var(--text-main, #334155)',
                                marginTop: '2px',
                                fontWeight: 500,
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                              }}
                            >
                              {act.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mandatory Rule 11 Pagination */}
                {totalItems > 0 && (
                  <div
                    style={{
                      paddingTop: '8px',
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
              </>
            )}
          </div>

          {/* Modal Footer with Actions */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
            }}
          >
            {/* Left side: Delete (Tenant Admin only) */}
            <div>
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
                  <span>{t('inventory.deleteModal.titleItem', 'Delete Item')}</span>
                </button>
              )}
            </div>

            {/* Right side: Close, Increase Stock, Edit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                }}
              >
                {t('common.close', 'Close')}
              </button>

              {/* Increase Stock Action */}
              {!isTenantAdmin && onAddStock && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddStock(item);
                  }}
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} />
                  <span>{t('inventory.buttons.increaseStock', 'Increase Stock')}</span>
                </button>
              )}

              {/* Edit Action */}
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
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                  }}
                >
                  <Edit2 size={14} />
                  <span>{t('inventory.editItem', 'Edit')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Field Changes & Details Secondary Modal */}
      {selectedActivityForChanges && (
        <FieldChangesModal
          isOpen={Boolean(selectedActivityForChanges)}
          onClose={() => setSelectedActivityForChanges(null)}
          item={item}
          activity={selectedActivityForChanges}
        />
      )}
    </>
  );
};
