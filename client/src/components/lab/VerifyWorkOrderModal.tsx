import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader,
} from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { workOrderService, WorkOrderListItem } from '../../services/workOrderService';
import { EditWorkOrderModal } from './EditWorkOrderModal';

interface VerifyWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  folioNumber: string;
  patient: string;
  processId: string;
  processName: string;
  processType: string;
  onComplete: () => void;
}

export const VerifyWorkOrderModal: React.FC<VerifyWorkOrderModalProps> = ({
  isOpen,
  onClose,
  workOrderId,
  folioNumber,
  patient,
  processId,
  processName,
  processType,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkWOData, setReworkWOData] = useState<WorkOrderListItem | null>(null);

  if (!isOpen) return null;

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await workOrderService.evaluateVerification(workOrderId, processId, {
        outcome: 'SUCCESS',
        notes: 'Verification approved.',
      });
      toast.success(t('verifyWorkOrder.approveSuccess'));
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('verifyWorkOrder.actionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepetition = async () => {
    setSubmitting(true);
    try {
      await workOrderService.evaluateVerification(workOrderId, processId, {
        outcome: 'REPETITION',
        notes: 'Full repetition required.',
      });
      toast.success(t('verifyWorkOrder.repetitionSuccess'));
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('verifyWorkOrder.actionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReworkClick = async () => {
    // Load full WO data to pass to EditWorkOrderModal
    try {
      const wo = await workOrderService.getById(workOrderId);
      setReworkWOData(wo);
      setShowReworkModal(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('verifyWorkOrder.actionFailed'));
    }
  };

  // If rework mode is triggered, hide the verify popup completely and render only the EditWorkOrderModal
  if (showReworkModal && reworkWOData) {
    return (
      <EditWorkOrderModal
        workOrder={reworkWOData}
        isOpen={true}
        onClose={() => {
          setShowReworkModal(false);
          setReworkWOData(null);
          onClose();
        }}
        onSuccess={() => {
          setShowReworkModal(false);
          setReworkWOData(null);
          onComplete();
          onClose();
        }}
        reworkMode={true}
        reworkVerificationProcessId={processId}
      />
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: '100%', maxWidth: '420px',
        borderRadius: '16px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'scaleIn 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} style={{ color: 'var(--primary-600)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('verifyWorkOrder.title')}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('verifyWorkOrder.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'transparent',
              cursor: 'pointer', color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* WO Info Card */}
          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('verifyWorkOrder.order', 'Order')}: <strong style={{ color: 'var(--text-main)' }}>{folioNumber}</strong>
              {patient && <span> ({patient})</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('verifyWorkOrder.verificationStage', 'Verification Stage')}: <strong style={{ color: 'var(--text-main)' }}>{processName}</strong>
            </div>
          </div>

          {/* Outcome Label */}
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>
            {t('verifyWorkOrder.selectOutcome', 'Select the outcome:')}
          </p>

          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px', borderRadius: '10px',
              border: '2px solid var(--emerald-400)',
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--emerald-600)',
              cursor: submitting ? 'wait' : 'pointer',
              fontSize: '14px', fontWeight: 700,
              marginBottom: '10px',
              transition: 'all 0.15s ease',
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.backgroundColor = 'var(--emerald-100)'; e.currentTarget.style.borderColor = 'var(--emerald-500)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--badge-success-bg)'; e.currentTarget.style.borderColor = 'var(--emerald-400)'; }}
          >
            {submitting ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={18} />}
            {t('verifyWorkOrder.approveTitle', 'Approve (Success)')}
          </button>

          {/* Rework Button */}
          <button
            onClick={handleReworkClick}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px', borderRadius: '10px',
              border: '2px solid var(--amber-300)',
              backgroundColor: 'var(--badge-warning-bg)',
              color: 'var(--amber-600)',
              cursor: submitting ? 'wait' : 'pointer',
              fontSize: '14px', fontWeight: 700,
              marginBottom: '10px',
              transition: 'all 0.15s ease',
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.backgroundColor = 'var(--amber-100)'; e.currentTarget.style.borderColor = 'var(--amber-500)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--badge-warning-bg)'; e.currentTarget.style.borderColor = 'var(--amber-300)'; }}
          >
            <AlertTriangle size={18} />
            {t('verifyWorkOrder.reworkTitle', 'Flag (Rework Needed)')}
          </button>

          {/* Repetition Button */}
          <button
            onClick={handleRepetition}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px', borderRadius: '10px',
              border: '2px solid var(--rose-300)',
              backgroundColor: 'var(--badge-danger-bg)',
              color: 'var(--rose-600)',
              cursor: submitting ? 'wait' : 'pointer',
              fontSize: '14px', fontWeight: 700,
              marginBottom: '4px',
              transition: 'all 0.15s ease',
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.backgroundColor = 'var(--rose-100)'; e.currentTarget.style.borderColor = 'var(--rose-500)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--badge-danger-bg)'; e.currentTarget.style.borderColor = 'var(--rose-300)'; }}
          >
            <RotateCcw size={18} />
            {t('verifyWorkOrder.repetitionTitle', 'Flag (Repetition Needed)')}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', textAlign: 'right',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-muted)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent', color: 'var(--text-main)',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}
          >
            {t('verifyWorkOrder.cancel')}
          </button>
        </div>
      </div>
    </>
  );
};

export default VerifyWorkOrderModal;
