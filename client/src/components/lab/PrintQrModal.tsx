import React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, X, QrCode } from 'lucide-react';
import { WorkOrderListItem } from '../../services/workOrderService';

interface PrintQrModalProps {
  workOrder: WorkOrderListItem;
  onClose: () => void;
}

export const PrintQrModal: React.FC<PrintQrModalProps> = ({ workOrder, onClose }) => {
  const { t } = useTranslation();

  const handlePrint = () => {
    window.print();
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    workOrder.qrToken || workOrder.folioNumber,
  )}`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="print-area"
        style={{
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} style={{ color: 'var(--primary-600)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('technician.qrModal.title', { defaultValue: 'Work Order QR Code' })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '15px',
              marginBottom: '12px',
            }}
          >
            WO#: {workOrder.folioNumber}
          </div>

          {workOrder.patient && (
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '16px' }}>
              {workOrder.patient}
            </div>
          )}

          {/* QR Code Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '12px',
              borderRadius: '12px',
              display: 'inline-block',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
            }}
          >
            <img
              src={qrUrl}
              alt={`QR Code for ${workOrder.folioNumber}`}
              style={{ width: '180px', height: '180px', display: 'block' }}
            />
          </div>

          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              textAlign: 'left',
              backgroundColor: 'var(--bg-surface)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <strong style={{ color: 'var(--text-main)' }}>{t('technician.prosthesis', { defaultValue: 'Prosthesis' })}:</strong>{' '}
              {workOrder.prosthesisType?.name || '—'}
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>{t('technician.doctor', { defaultValue: 'Doctor' })}:</strong>{' '}
              {workOrder.doctor?.name || '—'}
            </div>
            {workOrder.boxNumber && (
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{t('technician.boxNumber', { defaultValue: 'Box Number' })}:</strong>{' '}
                {workOrder.boxNumber}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary-600)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Printer size={15} />
            <span>{t('technician.print', { defaultValue: 'Print' })}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
