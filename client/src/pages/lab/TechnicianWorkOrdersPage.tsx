import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  QrCode,
  MessageSquare,
  ClipboardList,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { useNotifications } from '../../core/context/NotificationContext';
import { formatDate } from '../../core/utils/dateUtils';
import {
  workOrderService,
  WorkOrderListItem,
} from '../../services/workOrderService';
import { ViewWorkOrderModal } from '../../components/lab/ViewWorkOrderModal';
import { TechnicianWorkOrderDetailModal } from '../../components/lab/TechnicianWorkOrderDetailModal';
import { QrCodeModal } from '../../components/lab/QrCodeModal';
import { Tooltip } from '../../components/common/Tooltip';

export const TechnicianWorkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [orders, setOrders] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NOT_STARTED' | 'IN_PROGRESS_PAUSED' | 'COMPLETED'>('ALL');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [chatWorkOrder, setChatWorkOrder] = useState<WorkOrderListItem | null>(null);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Record<string, number>>({});
  const [unreadChatFilter, setUnreadChatFilter] = useState(false);
  const [qrWorkOrder, setQrWorkOrder] = useState<WorkOrderListItem | null>(null);

  const { socket } = useNotifications();

  // Socket listener for real-time incoming chat messages
  useEffect(() => {
    if (!socket) return;
    const handleIncomingChatMessage = (payload: any) => {
      if (payload?.workOrderId) {
        setUnreadChatCounts((prev) => ({
          ...prev,
          [payload.workOrderId]: (prev[payload.workOrderId] || 0) + 1,
        }));
      }
    };
    socket.on('work_order:chat_message', handleIncomingChatMessage);
    return () => {
      socket.off('work_order:chat_message', handleIncomingChatMessage);
    };
  }, [socket]);

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await workOrderService.getTechnicianWorkOrders({
        search: search.trim() || undefined,
        status: activeFilter === 'ALL' ? undefined : activeFilter,
        hasUnreadChat: unreadChatFilter ? true : undefined,
        limit: 50,
      });
      const items = res.data || [];
      setOrders(items);

      // Fetch unread chat counts for these work orders
      if (items.length > 0) {
        const ids = items.map((o: any) => o.id);
        workOrderService.getUnreadChatCounts(ids).then((counts) => {
          setUnreadChatCounts(counts || {});
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to load technician work orders:', err);
      if (!silent) {
        toast.error(err?.response?.data?.message || t('technician.errors.loadOrdersFailed', { defaultValue: 'Failed to load work orders' }));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, activeFilter, unreadChatFilter, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  // Real-time socket listener for instant assigned/process updates
  useEffect(() => {
    if (!socket) return;
    const handleRealtimeWorkOrdersSync = () => {
      fetchOrders(true);
    };

    socket.on('work_order:updated', handleRealtimeWorkOrdersSync);
    socket.on('work_order:process_updated', handleRealtimeWorkOrdersSync);
    socket.on('work_order:assigned', handleRealtimeWorkOrdersSync);
    socket.on('work_order:unassigned', handleRealtimeWorkOrdersSync);

    return () => {
      socket.off('work_order:updated', handleRealtimeWorkOrdersSync);
      socket.off('work_order:process_updated', handleRealtimeWorkOrdersSync);
      socket.off('work_order:assigned', handleRealtimeWorkOrdersSync);
      socket.off('work_order:unassigned', handleRealtimeWorkOrdersSync);
    };
  }, [socket, fetchOrders]);

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

        {/* Unread Chat Filter Tab */}
        <button
          type="button"
          onClick={() => setUnreadChatFilter((prev) => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '20px',
            border: unreadChatFilter ? 'none' : '1px solid var(--border-color)',
            backgroundColor: unreadChatFilter ? '#ef4444' : 'var(--bg-card)',
            color: unreadChatFilter ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={14} />
          <span>{t('technician.filters.unreadChat', { defaultValue: 'Unread Chat' })}</span>
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
                className="card card-interactive"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Card Hover Overlay */}
                <div className="card-hover-overlay">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkOrderId(order.id)}
                    className="btn btn-primary card-hover-overlay-btn"
                    style={{ gap: '8px', padding: '10px 20px', borderRadius: '10px' }}
                  >
                    <Eye size={16} />
                    <span>{t('technician.viewDetails', 'View Details')}</span>
                  </button>
                </div>

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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 6 }}>
                    {/* Chat Icon (replacing Notes icon, matching Screenshot 2) */}
                    {(() => {
                      const unread = unreadChatCounts[order.id] || 0;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setChatWorkOrder(order);
                            setUnreadChatCounts((prev) => ({ ...prev, [order.id]: 0 }));
                          }}
                          title={
                            unread > 0
                              ? t('workOrders.table.unreadCountTooltip', { count: unread, defaultValue: `${unread} unread messages` })
                              : t('technician.chatTooltip', { defaultValue: 'Order Chat' })
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: unread > 0 ? '#0284c7' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MessageSquare size={16} />
                          {unread > 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '-3px',
                                right: '-3px',
                                minWidth: '13px',
                                height: '13px',
                                padding: '0 2px',
                                borderRadius: '999px',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                fontSize: '8px',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                              }}
                            >
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* QR Code icon */}
                    <Tooltip content={t('workOrders.table.qrTooltip', 'View QR Code')}>
                      <button
                        type="button"
                        onClick={() => setQrWorkOrder(order)}
                        aria-label={t('workOrders.table.qrTooltip', 'View QR Code')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <QrCode size={16} />
                      </button>
                    </Tooltip>
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
                  <div style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <strong style={{ color: 'var(--text-heading)' }}>{t('technician.deliveryDate', { defaultValue: 'Delivery Date' })}:</strong>{' '}
                    <span style={{ fontWeight: 600, color: order.deliveryDate ? '#0284c7' : 'var(--text-muted)' }}>
                      {order.deliveryDate ? formatDate(order.deliveryDate) : '—'}
                    </span>
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
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{stepName}</span>
                      {myProcess?.reworkActive && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--rose-600)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={10} />
                          <span>
                            {t('rework.activeAlertTitle', {
                              count: myProcess.reworkCount || 1,
                              defaultValue: `Rework Active (Cycle #${myProcess.reworkCount || 1})`,
                            })}
                          </span>
                        </span>
                      )}
                      {!myProcess?.reworkActive && (myProcess?.reworkCount || 0) > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={10} />
                          <span>
                            {t('rework.repeatedBadge', {
                              count: myProcess.reworkCount,
                              defaultValue: `Reworked (${myProcess.reworkCount}x)`,
                            })}
                          </span>
                        </span>
                      )}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {t('technician.createdDate', { defaultValue: 'Created' })}: {formatDate(order.createdAt)}
                    </span>
                    {order.deliveryDate && (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0284c7' }}>
                        {t('technician.deliveryDate', { defaultValue: 'Delivery' })}: {formatDate(order.deliveryDate)}
                      </span>
                    )}
                  </div>

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

      {/* Chat Tab in View Work Order Modal */}
      {chatWorkOrder && (
        <ViewWorkOrderModal
          workOrder={chatWorkOrder}
          isOpen={Boolean(chatWorkOrder)}
          initialTab="chat"
          onClose={() => setChatWorkOrder(null)}
          onOrderUpdated={fetchOrders}
        />
      )}

      {/* QR Code Modal */}
      {qrWorkOrder && (
        <QrCodeModal order={qrWorkOrder} onClose={() => setQrWorkOrder(null)} />
      )}
    </div>
  );
};
