import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../core/context/AuthContext';
import { useToast } from '../core/context/ToastContext';
import { formatDate, formatDateTime } from '../core/utils/dateUtils';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Tooltip } from '../components/common/Tooltip';
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';

interface QrInquiryItem {
  id: string;
  tenantId: string;
  workOrderId: string;
  workOrderFolio: string;
  name: string;
  email: string;
  phone: string;
  message?: string | null;
  status: string; // NEW, CONTACTED, CLOSED
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };
  workOrder?: {
    id: string;
    folioNumber: string;
    status: string;
    patient?: string | null;
  } | null;
}

export const QrInquiriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const toast = useToast();

  const [inquiries, setInquiries] = useState<QrInquiryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTenant, setSelectedTenant] = useState<string>('ALL');
  const [tenantsList, setTenantsList] = useState<Array<{ value: string; label: string }>>([]);

  // Modals
  const [inquiryToView, setInquiryToView] = useState<QrInquiryItem | null>(null);
  const [inquiryToDelete, setInquiryToDelete] = useState<QrInquiryItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Fetch tenants for dropdown filter (Platform Super Admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get('/tenants')
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setTenantsList([
          { value: 'ALL', label: t('qrInquiries.filters.allTenants', 'All Tenants') },
          ...items.map((t: any) => ({
            value: t.id,
            label: `${t.name} (${t.slug})`,
          })),
        ]);
      })
      .catch(() => {});
  }, [isSuperAdmin, t]);

  // Fetch Inquiries
  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (isSuperAdmin && selectedTenant !== 'ALL') params.tenantId = selectedTenant;

      const res = await api.get('/platform/qr-inquiries', { params });
      const raw = res.data;
      const data: QrInquiryItem[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      const meta = (res as any).meta || raw?.meta || {};

      setInquiries(data);
      const total = meta.total !== undefined ? meta.total : data.length;
      setTotalCount(total);
      setTotalPages(meta.totalPages || Math.max(1, Math.ceil(total / pageSize)));
    } catch (err) {
      console.error('Failed to load QR inquiries:', err);
      toast.error(t('qrInquiries.loadFailed', 'Failed to load QR inquiries'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, isSuperAdmin, pageSize, search, selectedStatus, selectedTenant, t]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Status Change Handler
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);
      await api.patch(`/platform/qr-inquiries/${id}/status`, { status: newStatus });
      toast.success(t('qrInquiries.statusUpdated', 'Inquiry status updated'));
      if (inquiryToView && inquiryToView.id === id) {
        setInquiryToView({ ...inquiryToView, status: newStatus });
      }
      fetchInquiries();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error(err?.response?.data?.message || t('qrInquiries.statusUpdateFailed', 'Failed to update status'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete Handler
  const handleDeleteInquiry = async () => {
    if (!inquiryToDelete) return;
    try {
      setDeleting(true);
      await api.delete(`/platform/qr-inquiries/${inquiryToDelete.id}`);
      toast.success(t('qrInquiries.deleteSuccess', 'Inquiry deleted successfully'));
      setInquiryToDelete(null);
      fetchInquiries();
    } catch (err: any) {
      console.error('Failed to delete inquiry:', err);
      toast.error(err?.response?.data?.message || t('qrInquiries.deleteFailed', 'Failed to delete inquiry'));
    } finally {
      setDeleting(false);
    }
  };

  // Status Badge UI
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return {
          label: t('qrInquiries.statusNew', 'New Lead'),
          bg: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
        };
      case 'CONTACTED':
        return {
          label: t('qrInquiries.statusContacted', 'Contacted'),
          bg: 'rgba(234, 179, 8, 0.12)',
          color: '#eab308',
          border: 'rgba(234, 179, 8, 0.3)',
        };
      case 'CLOSED':
        return {
          label: t('qrInquiries.statusClosed', 'Closed'),
          bg: 'rgba(34, 197, 94, 0.12)',
          color: '#22c55e',
          border: 'rgba(34, 197, 94, 0.3)',
        };
      default:
        return {
          label: status,
          bg: 'rgba(100, 116, 139, 0.12)',
          color: '#64748b',
          border: 'rgba(100, 116, 139, 0.3)',
        };
    }
  };

  const newLeadsCount = inquiries.filter((i) => i.status === 'NEW').length;
  const contactedCount = inquiries.filter((i) => i.status === 'CONTACTED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* ─── PAGE HEADER ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              margin: '0 0 4px 0',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-heading)',
              fontFamily: 'var(--font-heading)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <QrCode size={26} style={{ color: 'var(--primary-600)' }} />
            <span>{t('qrInquiries.title', 'QR Tracking Inquiries & Leads')}</span>
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {t(
              'qrInquiries.subtitle',
              'Review and manage prospective client inquiries submitted via public Work Order QR tracking pages.',
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchInquiries}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} />
          <span>{t('common.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* ─── KPI METRICS ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Inbox size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('qrInquiries.stats.total', 'Total Inquiries')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
              {totalCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('qrInquiries.stats.newLeads', 'New Leads')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#3b82f6' }}>
              {newLeadsCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('qrInquiries.stats.contacted', 'Contacted')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#eab308' }}>
              {contactedCount}
            </div>
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH BAR ────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {/* Search */}
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
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('qrInquiries.searchPlaceholder', 'Search by name, email, phone, or folio...')}
            style={{ paddingLeft: '36px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Tenant Filter (Platform Super Admin only) */}
        {isSuperAdmin && (
          <div style={{ width: '220px' }}>
            <SearchableSelect
              options={tenantsList}
              value={selectedTenant}
              onChange={(val) => {
                setSelectedTenant(val);
                setCurrentPage(1);
              }}
              placeholder={t('qrInquiries.filters.tenantPlaceholder', 'Filter by Tenant')}
            />
          </div>
        )}

        {/* Status Filter */}
        <div style={{ width: '180px' }}>
          <SearchableSelect
            options={[
              { value: 'ALL', label: t('common.allStatuses', 'All Statuses') },
              { value: 'NEW', label: t('qrInquiries.statusNew', 'New Lead') },
              { value: 'CONTACTED', label: t('qrInquiries.statusContacted', 'Contacted') },
              { value: 'CLOSED', label: t('qrInquiries.statusClosed', 'Closed') },
            ]}
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            placeholder={t('qrInquiries.filters.statusPlaceholder', 'Filter by Status')}
          />
        </div>
      </div>

      {/* ─── DATA TABLE (AGENTS.md Rule 13 Compliant) ────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.tenant', 'Tenant Organization')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.workOrder', 'WO Folio')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.contact', 'Contact Lead')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.phone', 'Phone')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.message', 'Message')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.date', 'Submitted At')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('qrInquiries.table.status', 'Status')}
                </th>
                <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Loading inquiries...')}
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <Inbox size={24} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                      {t('qrInquiries.noInquiriesFound', 'No QR inquiries found')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {t('qrInquiries.noInquiriesDesc', 'Leads submitted via the public QR tracking page will appear here.')}
                    </div>
                  </td>
                </tr>
              ) : (
                inquiries.map((inquiry) => {
                  const badge = getStatusBadge(inquiry.status);

                  return (
                    <tr
                      key={inquiry.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* 1. Tenant */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                              {inquiry.tenant?.name || '—'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {inquiry.tenant?.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Work Order Folio */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: 'var(--primary-600)',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(37, 99, 235, 0.2)',
                            fontSize: '12px',
                          }}
                        >
                          {inquiry.workOrderFolio}
                        </span>
                        {inquiry.workOrder?.patient && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {inquiry.workOrder.patient}
                          </div>
                        )}
                      </td>

                      {/* 3. Contact Lead */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                          {inquiry.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={12} />
                          <span>{inquiry.email}</span>
                        </div>
                      </td>

                      {/* 4. Phone */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                          <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{inquiry.phone || '—'}</span>
                        </div>
                      </td>

                      {/* 5. Message Snippet */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle', maxWidth: '200px' }}>
                        {inquiry.message ? (
                          <Tooltip content={inquiry.message}>
                            <div
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: 'var(--text-muted)',
                                cursor: 'help',
                              }}
                            >
                              {inquiry.message}
                            </div>
                          </Tooltip>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                            {t('common.none', 'None')}
                          </span>
                        )}
                      </td>

                      {/* 6. Date Submitted */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-muted)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {formatDateTime(inquiry.createdAt)}
                      </td>

                      {/* 7. Status */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontSize: '11.5px',
                            fontWeight: 700,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* 8. Action Column */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* View Details */}
                          <Tooltip content={t('qrInquiries.viewTooltip', 'View Lead Details')}>
                            <button
                              type="button"
                              onClick={() => setInquiryToView(inquiry)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--primary-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={14} />
                            </button>
                          </Tooltip>

                          {/* Quick Status: Mark Contacted */}
                          {inquiry.status === 'NEW' && (
                            <Tooltip content={t('qrInquiries.markContactedTooltip', 'Mark as Contacted')}>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(inquiry.id, 'CONTACTED')}
                                className="btn-icon"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-card)',
                                  color: '#eab308',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            </Tooltip>
                          )}

                          {/* Delete Lead */}
                          <Tooltip content={t('common.delete', 'Delete Lead')}>
                            <button
                              type="button"
                              onClick={() => setInquiryToDelete(inquiry)}
                              className="btn-icon"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--rose-500, #ef4444)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: INQUIRY DETAILS & STATUS UPDATE ──────────── */}
      {inquiryToView && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setInquiryToView(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
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
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {t('qrInquiries.detailsTitle', 'Lead Inquiry Details')}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('qrInquiries.detailsSubtitle', 'Submitted via Work Order QR public tracking page')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInquiryToView(null)}
                className="btn-icon"
                style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Context Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('qrInquiries.table.tenant', 'Tenant Organization')}
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                    {inquiryToView.tenant?.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    slug: {inquiryToView.tenant?.slug}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('qrInquiries.table.workOrder', 'Work Order')}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-600)', marginTop: '2px' }}>
                    {inquiryToView.workOrderFolio}
                  </div>
                  {inquiryToView.workOrder?.patient && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {inquiryToView.workOrder.patient}
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Contact Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('qrInquiries.contactName', 'Contact Name')}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {inquiryToView.name}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('qrInquiries.email', 'Email Address')}
                    </div>
                    <a
                      href={`mailto:${inquiryToView.email}`}
                      style={{ fontSize: '13px', color: 'var(--primary-600)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {inquiryToView.email}
                    </a>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('qrInquiries.phone', 'Phone Number')}
                    </div>
                    {inquiryToView.phone ? (
                      <a
                        href={`tel:${inquiryToView.phone}`}
                        style={{ fontSize: '13px', color: 'var(--primary-600)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {inquiryToView.phone}
                      </a>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('qrInquiries.message', 'Message / Note')}
                  </div>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px',
                      color: 'var(--text-main)',
                      lineHeight: 1.5,
                      minHeight: '48px',
                    }}
                  >
                    {inquiryToView.message || t('common.noMessageProvided', 'No message provided by user.')}
                  </div>
                </div>

                {/* Date */}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('qrInquiries.dateLabel', 'Received on')}: {formatDateTime(inquiryToView.createdAt)}
                </div>
              </div>

              {/* Status Update Row */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>
                  {t('qrInquiries.updateStatus', 'Update Status')}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={updatingStatus || inquiryToView.status === 'NEW'}
                    onClick={() => handleUpdateStatus(inquiryToView.id, 'NEW')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      backgroundColor: inquiryToView.status === 'NEW' ? 'var(--primary-600)' : 'var(--bg-surface)',
                      color: inquiryToView.status === 'NEW' ? '#ffffff' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('qrInquiries.statusNew', 'New')}
                  </button>

                  <button
                    type="button"
                    disabled={updatingStatus || inquiryToView.status === 'CONTACTED'}
                    onClick={() => handleUpdateStatus(inquiryToView.id, 'CONTACTED')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      backgroundColor: inquiryToView.status === 'CONTACTED' ? '#eab308' : 'var(--bg-surface)',
                      color: inquiryToView.status === 'CONTACTED' ? '#000000' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('qrInquiries.statusContacted', 'Contacted')}
                  </button>

                  <button
                    type="button"
                    disabled={updatingStatus || inquiryToView.status === 'CLOSED'}
                    onClick={() => handleUpdateStatus(inquiryToView.id, 'CLOSED')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      backgroundColor: inquiryToView.status === 'CLOSED' ? '#22c55e' : 'var(--bg-surface)',
                      color: inquiryToView.status === 'CLOSED' ? '#ffffff' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('qrInquiries.statusClosed', 'Closed')}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-modal, var(--bg-card))',
              }}
            >
              <button
                type="button"
                onClick={() => setInquiryToView(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE CONFIRMATION ─────────────────────── */}
      {inquiryToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setInquiryToDelete(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--rose-500, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('qrInquiries.deleteConfirmTitle', 'Delete Lead Inquiry?')}
            </h3>

            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {t('qrInquiries.deleteConfirmMsg', {
                name: inquiryToDelete.name,
                defaultValue: `Are you sure you want to delete the inquiry from ${inquiryToDelete.name}? This action cannot be undone.`,
              })}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setInquiryToDelete(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
                disabled={deleting}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteInquiry}
                className="btn btn-danger"
                style={{ padding: '8px 18px', fontSize: '13px' }}
                disabled={deleting}
              >
                {deleting ? t('common.loading', 'Deleting...') : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
