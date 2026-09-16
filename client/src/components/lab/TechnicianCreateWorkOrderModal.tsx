import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { Tooltip } from '../common/Tooltip';
import api from '../../services/api';
import { workOrderService } from '../../services/workOrderService';
import { doctorService, DoctorListItem } from '../../services/doctor.service';

interface TechnicianCreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TechnicianCreateWorkOrderModal: React.FC<TechnicianCreateWorkOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Reference data
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<any[]>([]);
  const [folioPreview, setFolioPreview] = useState<string>('---');
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Form Fields (General Info only)
  const [doctorId, setDoctorId] = useState('');
  const [patient, setPatient] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [prosthesisTypeId, setProsthesisTypeId] = useState('');
  const [specification, setSpecification] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');

  // Validation & Submission
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDoctorId('');
      setPatient('');
      setFileNumber('');
      setBoxNumber('');
      setDeliveryDate('');
      setProsthesisTypeId('');
      setSpecification('');
      setColor('');
      setNotes('');
      setErrors({});
      loadReferenceData();
    }
  }, [isOpen]);

  const loadReferenceData = useCallback(async () => {
    try {
      setLoadingRefs(true);
      const [doctorsRes, ptRes, folioRes] = await Promise.all([
        doctorService.getAll().catch(() => []),
        api.get('/lab/prosthesis-types').catch(() => ({ data: [] })),
        workOrderService.getNextFolio().catch(() => ({ folioNumber: '---' })),
      ]);

      const activeDocs = Array.isArray(doctorsRes) ? doctorsRes.filter((d) => d.isActive) : [];
      setDoctors(activeDocs);

      const rawPt = Array.isArray(ptRes.data) ? ptRes.data : (ptRes.data as any)?.data || [];
      setProsthesisTypes(rawPt);

      if (folioRes?.folioNumber) {
        setFolioPreview(folioRes.folioNumber);
      }
    } catch (err) {
      console.error('Failed to load reference data for requested order', err);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  // Options for searchable selects
  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        value: d.id,
        label: d.clinicName ? `${d.name} (${d.clinicName})` : d.name,
      })),
    [doctors],
  );

  const prosthesisOptions = useMemo(
    () =>
      prosthesisTypes.map((pt) => ({
        value: pt.id,
        label: pt.name,
      })),
    [prosthesisTypes],
  );

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!doctorId) {
      errs.doctorId = t(
        'technician.createRequestModal.validation.doctorRequired',
        'Please select a doctor',
      );
    }
    if (!patient.trim()) {
      errs.patient = t(
        'technician.createRequestModal.validation.patientRequired',
        'Patient name is required',
      );
    }
    if (!prosthesisTypeId) {
      errs.prosthesisTypeId = t(
        'technician.createRequestModal.validation.prosthesisRequired',
        'Please select a prosthesis type',
      );
    }
    if (!deliveryDate) {
      errs.deliveryDate = t(
        'technician.createRequestModal.validation.deliveryDateRequired',
        'Delivery date is required',
      );
    }
    if (!specification.trim()) {
      errs.specification = t(
        'technician.createRequestModal.validation.specificationRequired',
        'Specification is required',
      );
    }
    if (!color.trim()) {
      errs.color = t(
        'technician.createRequestModal.validation.colorRequired',
        'Shade / color is required',
      );
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);

      const payload = {
        doctorId,
        patient: patient.trim(),
        fileNumber: fileNumber.trim() || undefined,
        boxNumber: boxNumber.trim() || undefined,
        deliveryDate: deliveryDate || undefined,
        prosthesisTypeId,
        specification: specification.trim(),
        color: color.trim(),
        notes: notes.trim() || undefined,
        action: 'create' as const,
      };

      await workOrderService.create(payload);

      toast.success(
        t(
          'technician.createRequestModal.alerts.requestSuccess',
          'Work order requested successfully!',
        ),
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create work order request', err);
      toast.error(
        err?.response?.data?.message ||
          t(
            'technician.createRequestModal.alerts.requestFailed',
            'Failed to submit work order request. Please try again.',
          ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-heading)',
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {t('technician.createRequestModal.title', 'New Work Order Request')}
              </h2>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--primary-color)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                {folioPreview}
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                margin: '3px 0 0',
              }}
            >
              {t(
                'technician.createRequestModal.subtitle',
                'Fill in general specifications to request work order creation',
              )}
            </p>
          </div>

          <Tooltip content={t('common.close', 'Close')}>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </Tooltip>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Info Notice Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                color: 'var(--text-main)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <Info size={18} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                {t(
                  'technician.createRequestModal.notice',
                  'This request will be created with status "Created". Standard recipe process steps will be auto-generated. Lab administration will review pricing, adjust assignees, and proceed.',
                )}
              </div>
            </div>

            {/* Row 1: Doctor & Patient */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Doctor */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.doctorLabel', 'Doctor / Clinic')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SearchableSelect
                  options={doctorOptions}
                  value={doctorId}
                  onChange={(val) => {
                    setDoctorId(val);
                    if (errors.doctorId) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.doctorId;
                        return copy;
                      });
                    }
                  }}
                  placeholder={t(
                    'technician.createRequestModal.doctorPlaceholder',
                    'Select doctor...',
                  )}
                  disabled={loadingRefs}
                />
                {errors.doctorId && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{errors.doctorId}</span>
                  </div>
                )}
              </div>

              {/* Patient */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.patientLabel', 'Patient Name')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={patient}
                  onChange={(e) => {
                    setPatient(e.target.value);
                    if (errors.patient) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.patient;
                        return copy;
                      });
                    }
                  }}
                  placeholder={t(
                    'technician.createRequestModal.patientPlaceholder',
                    'e.g. John Smith',
                  )}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: errors.patient ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                {errors.patient && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{errors.patient}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: File Number, Box Number, Delivery Date */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {/* File Number */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.fileNumberLabel', 'File Number (Optional)')}
                </label>
                <input
                  type="text"
                  value={fileNumber}
                  onChange={(e) => setFileNumber(e.target.value)}
                  placeholder={t(
                    'technician.createRequestModal.fileNumberPlaceholder',
                    'e.g. F-1029',
                  )}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Box Number */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.boxNumberLabel', 'Box Number (Optional)')}
                </label>
                <input
                  type="text"
                  value={boxNumber}
                  onChange={(e) => setBoxNumber(e.target.value)}
                  placeholder={t(
                    'technician.createRequestModal.boxNumberPlaceholder',
                    'e.g. B-04',
                  )}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.deliveryDateLabel', 'Delivery Date')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => {
                    setDeliveryDate(e.target.value);
                    if (errors.deliveryDate) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.deliveryDate;
                        return copy;
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: errors.deliveryDate ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                {errors.deliveryDate && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{errors.deliveryDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Prosthesis Type & Color */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Prosthesis Type */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.prosthesisTypeLabel', 'Prosthesis Type')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SearchableSelect
                  options={prosthesisOptions}
                  value={prosthesisTypeId}
                  onChange={(val) => {
                    setProsthesisTypeId(val);
                    if (errors.prosthesisTypeId) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.prosthesisTypeId;
                        return copy;
                      });
                    }
                  }}
                  placeholder={t(
                    'technician.createRequestModal.prosthesisTypePlaceholder',
                    'Select prosthesis type...',
                  )}
                  disabled={loadingRefs}
                />
                {errors.prosthesisTypeId && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{errors.prosthesisTypeId}</span>
                  </div>
                )}
              </div>

              {/* Color / Shade */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {t('technician.createRequestModal.colorLabel', 'Shade / Color')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    if (errors.color) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.color;
                        return copy;
                      });
                    }
                  }}
                  placeholder={t(
                    'technician.createRequestModal.colorPlaceholder',
                    'e.g. A2, 3D Master, BL3...',
                  )}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: errors.color ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                {errors.color && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{errors.color}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Specification */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: '6px',
                }}
              >
                {t('technician.createRequestModal.specificationLabel', 'Dental Specifications')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={specification}
                onChange={(e) => {
                  setSpecification(e.target.value);
                  if (errors.specification) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.specification;
                      return copy;
                    });
                  }
                }}
                placeholder={t(
                  'technician.createRequestModal.specificationPlaceholder',
                  'Enter detailed clinical specs or preparation notes...',
                )}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: errors.specification ? '1px solid #ef4444' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              {errors.specification && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '4px',
                  }}
                >
                  <AlertCircle size={12} />
                  <span>{errors.specification}</span>
                </div>
              )}
            </div>

            {/* Special Notes / Instructions (Optional) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  marginBottom: '6px',
                }}
              >
                {t('technician.createRequestModal.notesLabel', 'Special Notes / Instructions (Optional)')}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  'technician.createRequestModal.notesPlaceholder',
                  'Any additional notes for the lab administration...',
                )}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: 'var(--bg-modal-footer, var(--bg-surface))',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
              style={{ fontWeight: 600, padding: '8px 18px' }}
            >
              {t('technician.createRequestModal.cancelBtn', 'Cancel')}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                fontWeight: 700,
                padding: '8px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>{t('technician.createRequestModal.submittingBtn', 'Submitting...')}</span>
                </>
              ) : (
                <span>{t('technician.createRequestModal.submitBtn', 'Submit Request')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
