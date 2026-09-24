import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, List, FileText } from 'lucide-react';
import { financeService, type DoctorListBreakdownResponse } from '../../services/finance.service';
import { formatCurrency } from '../../core/utils/dateUtils';
import { useToast } from '../../core/context/ToastContext';
import { DoctorOrdersModal } from './DoctorOrdersModal';

interface Props {
  listId: string;
  listName: string;
  listDescription: string | null;
  branchId?: string;
  moduleKey?: string;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export const DoctorListBreakdownModal: React.FC<Props> = ({
  listId,
  listName,
  listDescription,
  branchId,
  moduleKey,
  startDate,
  endDate,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState<DoctorListBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewOrdersDoctor, setViewOrdersDoctor] = useState<{ id: string; name: string; clinicName: string | null } | null>(null);

  const fetchBreakdown = async () => {
    try {
      setLoading(true);
      const result = await financeService.getDoctorListBreakdown(listId, { moduleKey, branchId, startDate, endDate });
      setData(result);
    } catch {
      toast.error(t('finance.listBreakdown.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakdown();
  }, [listId]);

  return (
    <>
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
            maxWidth: '800px',
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
                <List size={18} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {listName}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {listDescription || '—'}
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
                  {t('finance.listBreakdown.quotedRevenue')}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                  {formatCurrency(data.summary.quoted)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('finance.listBreakdown.totalCollected')}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {formatCurrency(data.summary.collected)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {t('finance.listBreakdown.totalOutstandingBalance')}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: data.summary.outstanding > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                  {formatCurrency(data.summary.outstanding)}
                </div>
              </div>
            </div>
          )}

          {/* Section Title */}
          <div style={{ padding: '20px 24px 8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
              {t('finance.listBreakdown.memberDoctorsTitle', { name: listName })}
            </h3>
          </div>

          {/* Members Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.doctor')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.clinic')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.totalOrders')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.quoted')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.collected')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('finance.listBreakdown.outstanding')}</th>
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>{t('finance.listBreakdown.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('common.loading')}
                      </td>
                    </tr>
                  ) : !data || data.members.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('common.noData', 'No members found')}
                      </td>
                    </tr>
                  ) : (
                    data.members.map((member) => (
                      <tr key={member.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, verticalAlign: 'middle' }}>
                          {member.name}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>
                          {member.clinicName || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                          {member.totalOrders}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                          {formatCurrency(member.quoted)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: '#10b981' }}>
                          {formatCurrency(member.collected)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: member.outstanding > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                          {formatCurrency(member.outstanding)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => setViewOrdersDoctor({ id: member.id, name: member.name, clinicName: member.clinicName })}
                          >
                            <FileText size={13} />
                            {t('finance.listBreakdown.viewOrders')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Nested: Individual Doctor Orders Modal */}
      {viewOrdersDoctor && (
        <DoctorOrdersModal
          doctorId={viewOrdersDoctor.id}
          doctorName={viewOrdersDoctor.name}
          clinicName={viewOrdersDoctor.clinicName}
          branchId={branchId}
          moduleKey={moduleKey}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setViewOrdersDoctor(null)}
          onRefresh={() => { fetchBreakdown(); onRefresh?.(); }}
        />
      )}
    </>
  );
};
