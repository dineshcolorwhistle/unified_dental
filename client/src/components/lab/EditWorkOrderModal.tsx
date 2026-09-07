import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Loader2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkOrderListItem, workOrderService } from '../../services/workOrderService';
import { useToast } from '../../core/context/ToastContext';

interface EditWorkOrderModalProps {
  workOrder: WorkOrderListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditWorkOrderModal: React.FC<EditWorkOrderModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [patient, setPatient] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [color, setColor] = useState('');
  const [specification, setSpecification] = useState('');
  const [totalQuote, setTotalQuote] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentReferenceNumbers, setPaymentReferenceNumbers] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workOrder) {
      setPatient(workOrder.patient || '');
      setFileNumber(workOrder.fileNumber || '');
      setBoxNumber(workOrder.boxNumber || '');
      setDeliveryDate(
        workOrder.deliveryDate ? workOrder.deliveryDate.split('T')[0] : ''
      );
      setColor(workOrder.color || '');
      setSpecification(workOrder.specification || '');
      setTotalQuote(
        workOrder.totalQuote !== null && workOrder.totalQuote !== undefined
          ? String(workOrder.totalQuote)
          : ''
      );
      setInitialPayment(
        workOrder.initialPayment !== null && workOrder.initialPayment !== undefined
          ? String(workOrder.initialPayment)
          : ''
      );
      setPaymentReferenceNumbers(
        Array.isArray(workOrder.paymentReferenceNumbers)
          ? workOrder.paymentReferenceNumbers.join(', ')
          : ''
      );
    }
  }, [workOrder]);

  if (!isOpen || !workOrder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const parsedRefs = paymentReferenceNumbers
        ? paymentReferenceNumbers
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      await workOrderService.update(workOrder.id, {
        patient: patient.trim() || undefined,
        fileNumber: fileNumber.trim() || undefined,
        boxNumber: boxNumber.trim() || undefined,
        deliveryDate: deliveryDate || undefined,
        color: color.trim() || undefined,
        specification: specification.trim() || undefined,
        totalQuote: totalQuote !== '' ? Number(totalQuote) : undefined,
        initialPayment: initialPayment !== '' ? Number(initialPayment) : undefined,
        paymentReferenceNumbers: parsedRefs,
      });

      toast.success(
        t('workOrders.editModal.updateSuccess', {
          folio: workOrder.folioNumber,
          defaultValue: `Work Order "${workOrder.folioNumber}" updated successfully.`,
        })
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update work order', err);
      const msg =
        err?.response?.data?.message ||
        t('workOrders.editModal.updateFailed', 'Failed to update work order.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1060 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)' }}>
                  {t('workOrders.editModal.title', 'Edit Work Order')}
                </h3>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '13px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary-600)',
                  }}
                >
                  {workOrder.folioNumber}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('workOrders.editModal.subtitle', 'Update clinical specifications and financial details')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Clinical & Patient Information */}
            <div>
              <h4
                style={{
                  margin: '0 0 12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                }}
              >
                {t('workOrders.form.tabOrderInfo', 'Order Information')}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.patient', 'Patient Name')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={patient}
                    onChange={(e) => setPatient(e.target.value)}
                    placeholder="e.g. Maria Gonzalez"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.fileNumber', 'File Number')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={fileNumber}
                    onChange={(e) => setFileNumber(e.target.value)}
                    placeholder="e.g. EXP-2026-004"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.boxNumber', 'Box Number')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={boxNumber}
                    onChange={(e) => setBoxNumber(e.target.value)}
                    placeholder="e.g. BX-12"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.deliveryDate', 'Delivery Date')}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Prosthesis Details */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.color', 'Color / Shade')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. A1, 2M2, Bleach"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.specification', 'Clinical Specification / Instructions')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={specification}
                    onChange={(e) => setSpecification(e.target.value)}
                    placeholder="e.g. Translucent incisal edge, high polish finish..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4
                style={{
                  margin: '0 0 12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                }}
              >
                {t('workOrders.viewModal.financials', 'Financial Summary')}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.totalQuote', 'Total Quote')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={totalQuote}
                    onChange={(e) => setTotalQuote(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.initialPayment', 'Initial Payment')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={initialPayment}
                    onChange={(e) => setInitialPayment(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    {t('workOrders.form.paymentReferences', 'Payment Reference Numbers')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentReferenceNumbers}
                    onChange={(e) => setPaymentReferenceNumbers(e.target.value)}
                    placeholder="e.g. REC-9921, SPEI-002"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>{t('common.saving', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{t('workOrders.editModal.saveChanges', 'Save Changes')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
