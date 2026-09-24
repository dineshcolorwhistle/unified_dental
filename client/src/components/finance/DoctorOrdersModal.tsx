import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users, CreditCard, CheckCircle2 } from 'lucide-react';
import { financeService, type DoctorOrdersResponse } from '../../services/finance.service';
import { formatCurrency } from '../../core/utils/dateUtils';
import { useToast } from '../../core/context/ToastContext';

interface Props {
  doctorId: string;
  doctorName: string;
  clinicName: string | null;
  branchId?: string;
  moduleKey?: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export const DoctorOrdersModal: React.FC<Props> = ({
  doctorId,
  doctorName,
  clinicName,
  branchId,
  moduleKey,
  startDate,
  endDate,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState<DoctorOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchOrders = async (filterVal: 'pending' | 'all') => {
    try {
      setLoading(true);
      const result = await financeService.getDoctorOrders(doctorId, {
        filter: filterVal,
        branchId,
        moduleKey,
        startDate,
        endDate,
      });
      setData(result);
    } catch {
      toast.error(t('finance.doctorOrders.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(filter);
  }, [doctorId, filter]);

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      setMarkingId(orderId);
      await financeService.markOrderAsPaid(orderId);
      toast.success(t('finance.doctorOrders.markSuccess'));
      await fetchOrders(filter);
      onRefresh?.();
    } catch {
      toast.error(t('finance.doctorOrders.markFailed'));
    } finally {
      setMarkingId(null);
    }
  };

  return (
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '780px',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {doctorName}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {clinicName || '—'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary Banner */}
        {data && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface, var(--bg-app))',
              border: '1px solid var(--border-subtle, var(--border-color))',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {t('finance.doctorOrders.quotedRevenue')}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                {formatCurrency(data.summary.quoted)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {t('finance.doctorOrders.totalCollected')}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                {formatCurrency(data.summary.collected)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {t('finance.doctorOrders.totalOutstandingBalance')}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: data.summary.outstanding > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                {formatCurrency(data.summary.outstanding)}
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills */}
        {data && (
          <div style={{ padding: '16px 24px 0', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setFilter('pending')}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'pending' ? 'var(--primary-600)' : 'var(--bg-surface, #f1f5f9)',
                color: filter === 'pending' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {t('finance.doctorOrders.pending')} ({data.counts.pending})
            </button>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'all' ? 'var(--primary-600)' : 'var(--bg-surface, #f1f5f9)',
                color: filter === 'all' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {t('finance.doctorOrders.all')} ({data.counts.all})
            </button>
          </div>
        )}

        {/* Orders Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.doctorOrders.folio')}</th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.doctorOrders.patient')}</th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.doctorOrders.quoted')}</th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.doctorOrders.collected')}</th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.doctorOrders.outstanding')}</th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>{t('finance.doctorOrders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : !data || data.orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t('common.noData', 'No data available')}
                    </td>
                  </tr>
                ) : (
                  data.orders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', verticalAlign: 'middle' }}>
                        {order.folioNumber}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        {order.patient}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                        {formatCurrency(order.quoted)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: '#10b981' }}>
                        {formatCurrency(order.collected)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: order.outstanding > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {formatCurrency(order.outstanding)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {order.status === 'PENDING' ? (
                          <button
                            className="btn btn-primary"
                            disabled={markingId === order.id}
                            onClick={() => handleMarkAsPaid(order.id)}
                            style={{
                              padding: '5px 12px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              opacity: markingId === order.id ? 0.6 : 1,
                            }}
                          >
                            <CreditCard size={13} />
                            {t('finance.doctorOrders.markAsPaid')}
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#10b981',
                            }}
                          >
                            <CheckCircle2 size={14} />
                            {t('finance.doctorOrders.settled')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            {t('finance.doctorOrders.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
