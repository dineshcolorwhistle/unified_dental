import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  QrCode,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { formatDate } from '../../core/utils/dateUtils';
import {
  workOrderService,
  WorkOrderListItem,
} from '../../services/workOrderService';
import { TechnicianWorkOrderDetailModal } from '../../components/lab/TechnicianWorkOrderDetailModal';
import { PrintQrModal } from '../../components/lab/PrintQrModal';

export const TechnicianWorkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();

  const [orders, setOrders] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NOT_STARTED' | 'IN_PROGRESS_PAUSED' | 'COMPLETED'>('ALL');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [qrWorkOrder, setQrWorkOrder] = useState<WorkOrderListItem | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await workOrderService.getTechnicianWorkOrders({
        search: search.trim() || undefined,
        status: activeFilter === 'ALL' ? undefined : activeFilter,
        limit: 50,
      });
      setOrders(res.data);
    } catch (err: any) {
      console.error('Failed to load technician work orders:', err);
      toast.error(err?.response?.data?.message || t('technician.errors.loadOrdersFailed', { defaultValue: 'Failed to load work orders' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, activeFilter]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header & Search (Screenshot 2) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: 'var(--text-heading)',
              margin: '0 0 6px',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {t('technician.workOrders.title', { defaultValue: 'Work Orders' })}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
            {t('technician.workOrders.subtitle', { defaultValue: 'Manage and track your assigned process stages' })}
          </p>
        </div>

        {/* Live Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('technician.workOrders.searchPlaceholder', { defaultValue: 'Search by Folio, Patient or Doctor...' })}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Filter Tabs (Screenshot 2) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'ALL' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'ALL' ? '#38bdf8' : 'var(--bg-card)',
            color: activeFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {t('technician.filters.allAssigned', { defaultValue: 'All Assigned' })}
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('NOT_STARTED')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'NOT_STARTED' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'NOT_STARTED' ? '#38bdf8' : 'var(--bg-card)',
            color: activeFilter === 'NOT_STARTED' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {t('technician.filters.notStarted', { defaultValue: 'Not Started' })}
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('IN_PROGRESS_PAUSED')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'IN_PROGRESS_PAUSED' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'IN_PROGRESS_PAUSED' ? '#38bdf8' : 'var(--bg-card)',
            color: activeFilter === 'IN_PROGRESS_PAUSED' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {t('technician.filters.inProgressPaused', { defaultValue: 'In Progress / Paused' })}
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('COMPLETED')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'COMPLETED' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'COMPLETED' ? '#38bdf8' : 'var(--bg-card)',
            color: activeFilter === 'COMPLETED' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {t('technician.filters.completed', { defaultValue: 'Completed' })}
        </button>
      </div>

      {/* Work Orders Card Grid (Screenshot 2) */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          {t('common.loading', { defaultValue: 'Loading assigned work orders...' })}
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px dashed var(--border-color)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <ClipboardList size={36} style={{ color: 'var(--primary-400)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
            {t('technician.workOrders.noOrdersFound', { defaultValue: 'No work orders found' })}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('technician.workOrders.noOrdersDesc', { defaultValue: 'There are no work orders matching this filter or search query.' })}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {orders.map((order) => {
            const myProcess = (order as any).myProcess;
            const stepName = myProcess?.processName || '—';
            const stepStatus = myProcess?.status || 'NOT_STARTED';

            const statusBg =
              stepStatus === 'COMPLETED'
                ? '#dcfce7'
                : stepStatus === 'IN_PROGRESS'
                ? '#dbeafe'
                : stepStatus === 'PAUSED'
                ? '#fef3c7'
                : 'var(--bg-card)';

            const statusText =
              stepStatus === 'COMPLETED'
                ? '#15803d'
                : stepStatus === 'IN_PROGRESS'
                ? '#1d4ed8'
                : stepStatus === 'PAUSED'
                ? '#b45309'
                : 'var(--text-muted)';

            const statusLabel =
              stepStatus === 'COMPLETED'
                ? t('technician.status.completed', { defaultValue: 'COMPLETED' })
                : stepStatus === 'IN_PROGRESS'
                ? t('technician.status.inProgressUpper', { defaultValue: 'IN PROGRESS' })
                : stepStatus === 'PAUSED'
                ? t('technician.status.pausedUpper', { defaultValue: 'PAUSED' })
                : t('technician.status.notStartedUpper', { defaultValue: 'NOT STARTED' });

            const hasNotes = (order._count?.notesHistory || 0) > 0 || Boolean(order.notes);

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Card Header: Folio, Patient, Icons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
                      {order.folioNumber}
                    </span>
                    {order.patient && (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {order.patient}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Notes indicator */}
                    <button
                      type="button"
                      onClick={() => setSelectedWorkOrderId(order.id)}
                      title={t('technician.notesIndicator', { defaultValue: 'View Notes' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: hasNotes ? '#38bdf8' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        position: 'relative',
                      }}
                    >
                      <FileText size={16} />
                      {hasNotes && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                          }}
                        />
                      )}
                    </button>

                    {/* QR Code icon */}
                    <button
                      type="button"
                      onClick={() => setQrWorkOrder(order)}
                      title={t('technician.printQr', { defaultValue: 'Print QR' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <QrCode size={16} />
                    </button>
                  </div>
                </div>

                {/* Body Details (NO PAYMENT/FINANCIAL INFORMATION!) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-main)' }}>
                    <strong style={{ color: 'var(--text-heading)' }}>{t('technician.prosthesis', { defaultValue: 'Prosthesis' })}:</strong>{' '}
                    {order.prosthesisType?.name || '—'}
                  </div>
                  <div style={{ color: 'var(--text-main)' }}>
                    <strong style={{ color: 'var(--text-heading)' }}>{t('technician.doctor', { defaultValue: 'Doctor' })}:</strong>{' '}
                    {order.doctor?.name || '—'}
                    {order.doctor?.clinicName ? ` (${order.doctor.clinicName})` : ''}
                  </div>
                  <div style={{ color: 'var(--text-main)' }}>
                    <strong style={{ color: 'var(--text-heading)' }}>{t('technician.boxNo', { defaultValue: 'Box No.' })}:</strong>{' '}
                    {order.boxNumber || '—'}
                  </div>
                </div>

                {/* Step Assignment Box (Screenshot 2) */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('technician.myStepAssignment', { defaultValue: 'My Step Assignment' })}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                      {stepName}
                    </div>
                  </div>

                  <span
                    style={{
                      backgroundColor: statusBg,
                      color: statusText,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Card Footer: Created Date & Details Link */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('technician.createdDate', { defaultValue: 'Created' })}: {formatDate(order.createdAt)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedWorkOrderId(order.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <span>{t('technician.viewDetailsStepper', { defaultValue: 'View Details & Stepper >' })}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedWorkOrderId && (
        <TechnicianWorkOrderDetailModal
          workOrderId={selectedWorkOrderId}
          onClose={() => setSelectedWorkOrderId(null)}
          onRefresh={fetchOrders}
        />
      )}

      {/* Print QR Modal */}
      {qrWorkOrder && (
        <PrintQrModal workOrder={qrWorkOrder} onClose={() => setQrWorkOrder(null)} />
      )}
    </div>
  );
};
