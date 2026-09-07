import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Clock,
  PlayCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CircleDot,
  Loader2,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Eye,
  Pencil,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { Pagination } from '../../components/common/Pagination';
import { workOrderService, WorkOrderListItem } from '../../services/workOrderService';
import { CreateWorkOrderModal } from '../../components/lab/CreateWorkOrderModal';
import { ViewWorkOrderModal } from '../../components/lab/ViewWorkOrderModal';
import { EditWorkOrderModal } from '../../components/lab/EditWorkOrderModal';
import { formatDate, formatCurrency } from '../../core/utils/dateUtils';
import api from '../../services/api';

export const LabWorkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isTenantAdmin, isLabAdmin } = useAuth();

  // Role permissions
  const canCreate = isLabAdmin;
  const canDelete = isTenantAdmin || Boolean(user?.isSuperAdmin);

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
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [orderToView, setOrderToView] = useState<WorkOrderListItem | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<WorkOrderListItem | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<WorkOrderListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch branches for branch switcher (if Tenant Admin)
  useEffect(() => {
    if (isTenantAdmin || user?.isSuperAdmin) {
      api
        .get('/branches')
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
          setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
        })
        .catch(() => setBranches([]));
    }
  }, [isTenantAdmin, user?.isSuperAdmin]);

  // Fetch work orders
  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await workOrderService.getAll({
        search: search.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
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
      console.error('Failed to load work orders', err);
      toast.error(t('workOrders.alerts.loadFailed', 'Failed to load work orders'));
    } finally {
      setLoading(false);
    }
  }, [search, selectedStatus, selectedBranch, currentPage, pageSize, t]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Handle delete order
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      await workOrderService.delete(orderToDelete.id);
      toast.success(
        t('workOrders.alerts.deleteSuccess', {
          folio: orderToDelete.folioNumber,
          defaultValue: `Work Order ${orderToDelete.folioNumber} deleted.`,
        }),
      );
      setOrderToDelete(null);
      fetchWorkOrders();
    } catch (err: any) {
      console.error('Failed to delete work order', err);
      toast.error(err?.response?.data?.message || t('workOrders.alerts.deleteFailed', 'Failed to delete work order'));
    } finally {
      setDeleting(false);
    }
  };

  // Status Badge Configuration
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
          label: t('enums.workOrderStatus.INTERNAL_VERIFICATION', 'Internal Verification'),
          bg: 'rgba(139, 92, 246, 0.12)',
          color: '#8b5cf6',
          icon: <ShieldCheck size={12} />,
        };
      case 'EXTERNAL_VERIFICATION':
        return {
          label: t('enums.workOrderStatus.EXTERNAL_VERIFICATION', 'External Verification'),
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
          bg: 'var(--badge-neutral-bg)',
          color: 'var(--text-muted)',
          icon: <CircleDot size={12} />,
        };
    }
  };

  // Status Filter Options
  const statusOptions = [
    { value: 'ALL', label: t('common.allStatuses', 'All Statuses') },
    { value: 'CREATED', label: t('enums.workOrderStatus.CREATED', 'Created') },
    { value: 'ASSIGNED', label: t('enums.workOrderStatus.ASSIGNED', 'Assigned') },
    { value: 'IN_PROGRESS', label: t('enums.workOrderStatus.IN_PROGRESS', 'In Progress') },
    { value: 'INTERNAL_VERIFICATION', label: t('enums.workOrderStatus.INTERNAL_VERIFICATION', 'Internal Verification') },
    { value: 'EXTERNAL_VERIFICATION', label: t('enums.workOrderStatus.EXTERNAL_VERIFICATION', 'External Verification') },
    { value: 'COMPLETED', label: t('enums.workOrderStatus.COMPLETED', 'Completed') },
    { value: 'CANCELLED', label: t('enums.workOrderStatus.CANCELLED', 'Cancelled') },
  ];

  // Branch Filter Options
  const branchOptions = useMemo(() => {
    return [
      { value: 'ALL', label: t('common.allBranches', 'All Branches') },
      ...branches.map((b) => ({ value: b.id, label: b.name })),
    ];
  }, [branches, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ─── PAGE HEADER ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('workOrders.pageTitle', 'Work Orders')}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('workOrders.pageSubtitle', 'Manage and track dental lab work order production processes')}
            </p>
          </div>
        </div>

        {/* Action Button: Lab Admin Only can create WO */}
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>{t('workOrders.newWorkOrderBtn', 'New Work Order')}</span>
          </button>
        ) : (
          <Tooltip content={t('workOrders.adminOnlyCreateNotice', 'Only Lab Administrators can create Work Orders')}>
            <span style={{ display: 'inline-block' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} />
                <span>{t('workOrders.newWorkOrderBtn', 'New Work Order')}</span>
              </button>
            </span>
          </Tooltip>
        )}
      </div>

      {/* ─── KPI METRICS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClipboardList size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('workOrders.stats.total', 'Total Orders')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {totalOrders}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlayCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('workOrders.stats.inProgress', 'In Progress')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {orders.filter((o) => o.status === 'IN_PROGRESS').length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('workOrders.stats.verifications', 'Verifications')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {
                orders.filter(
                  (o) => o.status === 'INTERNAL_VERIFICATION' || o.status === 'EXTERNAL_VERIFICATION',
                ).length
              }
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('workOrders.stats.completed', 'Completed')}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {orders.filter((o) => o.status === 'COMPLETED').length}
            </div>
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH ───────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder={t('workOrders.searchPlaceholder', 'Search by folio, patient, doctor, box...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ width: '180px' }}>
          <SearchableSelect
            options={statusOptions}
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            placeholder={t('common.status', 'Status')}
          />
        </div>

        {(isTenantAdmin || user?.isSuperAdmin) && branches.length > 0 && (
          <div style={{ width: '180px' }}>
            <SearchableSelect
              options={branchOptions}
              value={selectedBranch}
              onChange={(val) => {
                setSelectedBranch(val);
                setCurrentPage(1);
              }}
              placeholder={t('common.branch', 'Branch')}
            />
          </div>
        )}

        <Tooltip content={t('common.refresh', 'Refresh')}>
          <button
            type="button"
            onClick={fetchWorkOrders}
            className="btn-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
          </button>
        </Tooltip>
      </div>

      {/* ─── DATA TABLE ─────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              gap: '12px',
            }}
          >
            <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('common.loading', 'Loading work orders...')}
            </span>
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <ClipboardList size={26} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 6px' }}>
              {t('workOrders.table.noOrdersTitle', 'No Work Orders Found')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: '380px' }}>
              {canCreate
                ? t('workOrders.table.noOrdersLabAdminDesc', 'Get started by creating your first dental lab work order.')
                : t('workOrders.table.noOrdersDesc', 'No work orders currently match the selected criteria.')}
            </p>
            {canCreate && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsCreateModalOpen(true)}
                style={{ fontWeight: 700 }}
              >
                <Plus size={14} />
                <span>{t('workOrders.newWorkOrderBtn', 'New Work Order')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.folio', 'Folio')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.patient', 'Patient')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.doctor', 'Doctor')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.color', 'Color')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.status', 'Status')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.quotedPrice', 'Quoted Price')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.createdBy', 'Created By')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('workOrders.table.createdAt', 'Created At')}
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('common.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const badge = getStatusBadge(order.status);

                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* 1. Folio */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              color: 'var(--primary-600)',
                            }}
                          >
                            {order.folioNumber}
                          </span>
                        </div>
                        {order.boxNumber && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                              display: 'inline-block',
                              marginTop: '3px',
                            }}
                          >
                            {order.boxNumber}
                          </span>
                        )}
                      </td>

                      {/* 2. Patient */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {order.patient || '—'}
                        </div>
                        {order.fileNumber && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {t('workOrders.file', 'File')}: {order.fileNumber}
                          </div>
                        )}
                      </td>

                      {/* 3. Doctor */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                          {order.doctor?.name || '—'}
                        </div>
                        {order.doctor?.clinicName && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {order.doctor.clinicName}
                          </div>
                        )}
                      </td>

                      {/* 4. Color */}
                      <td style={{ padding: '14px 18px' }}>
                        {order.color ? (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            {order.color}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* 6. Quoted Price */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {order.totalQuote !== null && order.totalQuote !== undefined
                            ? formatCurrency(Number(order.totalQuote))
                            : '—'}
                        </div>
                      </td>

                      {/* 7. Created By */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {order.createdBy?.name || '—'}
                        </div>
                      </td>

                      {/* 8. Created At */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {order.createdAt ? formatDate(order.createdAt) : '—'}
                        </div>
                      </td>

                      {/* 9. Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* View Work Order (for Lab Admin and Admin roles) */}
                          <Tooltip content={t('workOrders.table.viewTooltip', 'View Work Order')}>
                            <button
                              type="button"
                              onClick={() => setOrderToView(order)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--primary-600)',
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={14} />
                            </button>
                          </Tooltip>

                          {/* Edit Work Order (Lab Admin role) */}
                          {isLabAdmin && (
                            <Tooltip content={t('workOrders.table.editTooltip', 'Edit Work Order')}>
                              <button
                                type="button"
                                onClick={() => setOrderToEdit(order)}
                                className="btn-icon"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--text-main)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Delete (Platform & Tenant Admin Only) */}
                          {canDelete && (
                            <Tooltip content={t('workOrders.deleteTooltip', 'Delete Work Order')}>
                              <button
                                type="button"
                                onClick={() => setOrderToDelete(order)}
                                className="btn-icon"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-surface)',
                                  color: 'var(--rose-500)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalOrders}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ─── CREATE WORK ORDER MODAL ────────────────────────────── */}
      <CreateWorkOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchWorkOrders();
        }}
        branchId={selectedBranch !== 'ALL' ? selectedBranch : undefined}
      />

      {/* ─── VIEW WORK ORDER MODAL ──────────────────────────────── */}
      <ViewWorkOrderModal
        workOrder={orderToView}
        isOpen={Boolean(orderToView)}
        onClose={() => setOrderToView(null)}
        onOrderUpdated={fetchWorkOrders}
      />

      {/* ─── EDIT WORK ORDER MODAL ──────────────────────────────── */}
      <EditWorkOrderModal
        workOrder={orderToEdit}
        isOpen={Boolean(orderToEdit)}
        onClose={() => setOrderToEdit(null)}
        onSuccess={fetchWorkOrders}
      />

      {/* ─── DELETE CONFIRMATION MODAL ──────────────────────────── */}
      {orderToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1070 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px', textAlign: 'center' }}>
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
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 6px' }}>
              {t('workOrders.deleteModal.title', 'Delete Work Order')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 4px', fontWeight: 600 }}>
              {t('workOrders.deleteModal.confirm', {
                folio: orderToDelete.folioNumber,
                defaultValue: `Are you sure you want to delete ${orderToDelete.folioNumber}?`,
              })}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              {t('workOrders.deleteModal.warning', 'This will delete all associated process records and notes. This action cannot be undone.')}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOrderToDelete(null)}
                disabled={deleting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteOrder}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={16} className="spinner" /> : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
