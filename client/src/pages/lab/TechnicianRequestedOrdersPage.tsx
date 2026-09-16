import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Plus,
  Search,
  CircleDot,
  PlayCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { workOrderService, WorkOrderListItem } from '../../services/workOrderService';
import { TechnicianCreateWorkOrderModal } from '../../components/lab/TechnicianCreateWorkOrderModal';
import { ViewWorkOrderModal } from '../../components/lab/ViewWorkOrderModal';
import { formatDate } from '../../core/utils/dateUtils';

export const TechnicianRequestedOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Data state
  const [orders, setOrders] = useState<WorkOrderListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [orderToView, setOrderToView] = useState<WorkOrderListItem | null>(null);

  // Fetch requested work orders (filtered to logged-in user's requested orders)
  const fetchRequestedOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await workOrderService.getAll({
        search: search.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        myRequestedOnly: true,
        page: currentPage,
        limit: pageSize,
      });
      const items = Array.isArray(res) ? res : res?.data || [];
      const total = res?.meta?.total ?? items.length;
      const pages = res?.meta?.totalPages ?? 1;
      setOrders(items);
      setTotalOrders(total);
      setTotalPages(pages);
    } catch (err) {
      console.error('Failed to load requested work orders', err);
      toast.error(
        t(
          'technician.errors.loadOrdersFailed',
          'Failed to load requested work orders',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [search, selectedStatus, currentPage, pageSize, t, toast]);

  // Debounce search / filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequestedOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchRequestedOrders]);

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CREATED':
        return {
          label: t('enums.workOrderStatus.CREATED', 'Created'),
          bg: 'rgba(107, 114, 128, 0.12)',
          color: '#6b7280',
          icon: <CircleDot size={12} />,
        };
      case 'ASSIGNED':
        return {
          label: t('enums.workOrderStatus.ASSIGNED', 'Assigned'),
          bg: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          icon: <Clock size={12} />,
        };
      case 'IN_PROGRESS':
        return {
          label: t('enums.workOrderStatus.IN_PROGRESS', 'In Progress'),
          bg: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          icon: <PlayCircle size={12} />,
        };
      case 'INTERNAL_VERIFICATION':
        return {
          label: t(
            'enums.workOrderStatus.INTERNAL_VERIFICATION',
            'Internal Verification',
          ),
          bg: 'rgba(139, 92, 246, 0.12)',
          color: '#8b5cf6',
          icon: <ShieldCheck size={12} />,
        };
      case 'EXTERNAL_VERIFICATION':
        return {
          label: t(
            'enums.workOrderStatus.EXTERNAL_VERIFICATION',
            'External Verification',
          ),
          bg: 'rgba(99, 102, 241, 0.12)',
          color: '#6366f1',
          icon: <ShieldCheck size={12} />,
        };
      case 'COMPLETED':
        return {
          label: t('enums.workOrderStatus.COMPLETED', 'Completed'),
          bg: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          icon: <CheckCircle2 size={12} />,
        };
      case 'CANCELLED':
        return {
          label: t('enums.workOrderStatus.CANCELLED', 'Cancelled'),
          bg: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          icon: <XCircle size={12} />,
        };
      default:
        return {
          label: status,
          bg: 'var(--badge-neutral-bg, rgba(100, 116, 139, 0.1))',
          color: 'var(--text-muted)',
          icon: <CircleDot size={12} />,
        };
    }
  };

  const statusOptions = useMemo(
    () => [
      {
        value: 'ALL',
        label: t('technician.requestedOrders.allStatuses', 'All Statuses'),
      },
      {
        value: 'CREATED',
        label: t('enums.workOrderStatus.CREATED', 'Created'),
      },
      {
        value: 'ASSIGNED',
        label: t('enums.workOrderStatus.ASSIGNED', 'Assigned'),
      },
      {
        value: 'IN_PROGRESS',
        label: t('enums.workOrderStatus.IN_PROGRESS', 'In Progress'),
      },
      {
        value: 'INTERNAL_VERIFICATION',
        label: t(
          'enums.workOrderStatus.INTERNAL_VERIFICATION',
          'Internal Verification',
        ),
      },
      {
        value: 'EXTERNAL_VERIFICATION',
        label: t(
          'enums.workOrderStatus.EXTERNAL_VERIFICATION',
          'External Verification',
        ),
      },
      {
        value: 'COMPLETED',
        label: t('enums.workOrderStatus.COMPLETED', 'Completed'),
      },
    ],
    [t],
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* ─── PAGE HEADER ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--text-heading)',
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {t('technician.requestedOrders.title', 'Requested Orders')}
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {t(
                  'technician.requestedOrders.subtitle',
                  'Track and manage dental work orders you requested',
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action: Create Request */}
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            padding: '10px 18px',
            borderRadius: '10px',
          }}
        >
          <Plus size={18} />
          <span>
            {t('technician.requestedOrders.newRequestBtn', 'New Request')}
          </span>
        </button>
      </div>

      {/* ─── SEARCH & FILTER CONTROLS ───────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '460px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t(
              'technician.requestedOrders.searchPlaceholder',
              'Search by folio, patient, doctor, box...',
            )}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div style={{ width: '190px' }}>
            <SearchableSelect
              options={statusOptions}
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              placeholder={t('technician.requestedOrders.allStatuses', 'All Statuses')}
            />
          </div>

          {/* Refresh Button */}
          <Tooltip content={t('common.refresh', 'Refresh')}>
            <button
              type="button"
              onClick={() => fetchRequestedOrders()}
              className="btn btn-secondary"
              disabled={loading}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={15} className={loading ? 'spinner' : ''} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ─── DATA TABLE ─────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--table-th-bg, var(--bg-surface))',
                }}
              >
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.folio', 'FOLIO')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.patient', 'PATIENT')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.doctor', 'DOCTOR')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.prosthesis', 'PROSTHESIS TYPE')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.color', 'COLOR')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.status', 'STATUS')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('technician.requestedOrders.table.requestedDate', 'REQUESTED DATE')}
                </th>
                <th
                  style={{
                    padding: '12px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    textAlign: 'right',
                  }}
                >
                  {t('technician.requestedOrders.table.actions', 'ACTIONS')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 0', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Loader2 size={24} className="spinner" />
                      <span style={{ fontSize: '13px' }}>{t('common.loading', 'Loading...')}</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        maxWidth: '420px',
                        margin: '0 auto',
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          color: 'var(--primary-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Clock size={24} />
                      </div>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--text-heading)',
                          margin: 0,
                        }}
                      >
                        {t(
                          'technician.requestedOrders.noOrdersFound',
                          'No requested orders found',
                        )}
                      </h3>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {t(
                          'technician.requestedOrders.noOrdersDesc',
                          'You have not submitted any work order requests yet, or none match your search.',
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          fontSize: '13px',
                          marginTop: '6px',
                        }}
                      >
                        <Plus size={15} />
                        <span>
                          {t(
                            'technician.requestedOrders.submitFirstRequest',
                            'Submit New Request',
                          )}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((wo) => {
                  const badge = getStatusBadge(wo.status);

                  return (
                    <tr
                      key={wo.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="table-row-hover"
                    >
                      {/* Folio */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '13px',
                              color: 'var(--primary-color)',
                            }}
                          >
                            {wo.folioNumber}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {wo.boxNumber && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(100, 116, 139, 0.12)',
                                  color: 'var(--text-muted)',
                                  fontWeight: 600,
                                }}
                              >
                                Box: {wo.boxNumber}
                              </span>
                            )}
                            {wo.fileNumber && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(100, 116, 139, 0.12)',
                                  color: 'var(--text-muted)',
                                  fontWeight: 600,
                                }}
                              >
                                File: {wo.fileNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Patient */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                          {wo.patient || '---'}
                        </div>
                      </td>

                      {/* Doctor */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                          {wo.doctor?.name || '---'}
                        </div>
                        {wo.doctor?.clinicName && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {wo.doctor.clinicName}
                          </div>
                        )}
                      </td>

                      {/* Prosthesis Type */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {wo.prosthesisType?.name || '---'}
                          </span>
                        </div>
                      </td>

                      {/* Color */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {wo.color || '---'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '20px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Requested Date */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {formatDate(wo.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <Tooltip
                          content={t(
                            'technician.requestedOrders.table.viewDetails',
                            'View Details',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setOrderToView(wo)}
                            className="btn-icon"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary-color)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Eye size={17} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── PAGINATION ─────────────────────────────────────────── */}
        {!loading && totalOrders > 0 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalOrders}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ─── CREATE REQUEST MODAL ─────────────────────────────────── */}
      <TechnicianCreateWorkOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchRequestedOrders}
      />

      {/* ─── VIEW WORK ORDER MODAL ────────────────────────────────── */}
      <ViewWorkOrderModal
        workOrder={orderToView}
        isOpen={Boolean(orderToView)}
        onClose={() => setOrderToView(null)}
        onOrderUpdated={fetchRequestedOrders}
      />
    </div>
  );
};
