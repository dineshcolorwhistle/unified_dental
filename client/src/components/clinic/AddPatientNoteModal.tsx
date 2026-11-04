import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';
import { X, Calendar, FileText, UserCheck, ShieldCheck } from 'lucide-react';

export interface PatientOptionItem {
  id: string;
  recordNumber: string;
  firstName: string;
  fatherLastName?: string | null;
  motherLastName?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
}

interface AddPatientNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string | null;
  patientsList?: PatientOptionItem[];
}

export const AddPatientNoteModal: React.FC<AddPatientNoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  patientsList = [],
}) => {
  const { t } = useTranslation();
  const { success, error } = useToast();

  const [allPatients, setAllPatients] = useState<PatientOptionItem[]>(patientsList);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);

  // Today's date in YYYY-MM-DD format
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [noteDate, setNoteDate] = useState<string>(getTodayDateString());
  const [topic, setTopic] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset or load initial patient when modal opens
  useEffect(() => {
    if (isOpen) {
      setPatientId(initialPatientId || '');
      setNoteDate(getTodayDateString());
      setTopic('');
      setNote('');
      setValidationErrors({});

      // If patient list is empty, fetch available patients
      if (patientsList.length === 0) {
        setLoadingPatients(true);
        api
          .get('/clinic/patients?limit=100&status=ACTIVE')
          .then((res) => {
            const list = res.data?.patients || [];
            setAllPatients(list);
          })
          .catch(() => {
            // fallback
          })
          .finally(() => {
            setLoadingPatients(false);
          });
      } else {
        setAllPatients(patientsList);
      }
    }
  }, [isOpen, initialPatientId, patientsList]);

  // Build options for patient select: "Patient Name - +52..."
  const patientSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return allPatients.map((p) => {
      const parts = [p.firstName, p.fatherLastName, p.motherLastName].filter(Boolean);
      const fullName = parts.join(' ').trim();
      const phone = p.phoneNumber
        ? `${p.phoneCountryCode || '+52'}${p.phoneNumber}`
        : '';
      const displayLabel = phone ? `${fullName} - ${phone}` : fullName;

      return {
        value: p.id,
        label: displayLabel,
        sublabel: p.recordNumber,
      };
    });
  }, [allPatients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!patientId) {
      errors.patientId = t('clinicPatients.addNoteModal.patientRequired', 'Patient is required');
    }
    if (!noteDate) {
      errors.noteDate = t('clinicPatients.addNoteModal.noteDateRequired', 'Note date is required');
    }
    if (!note.trim()) {
      errors.note = t('clinicPatients.addNoteModal.noteRequired', 'Please fill in this field.');
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/clinic/patients/${patientId}/notes`, {
        patientId,
        noteDate,
        topic: topic.trim() || undefined,
        note: note.trim(),
      });

      success(
        t('clinicPatients.addNoteModal.createSuccess', 'Clinical note created successfully.')
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        t('clinicPatients.addNoteModal.createFailed', 'Failed to create clinical note.');
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600, #0284c7)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-heading, #0f172a)',
                }}
              >
                {t('clinicPatients.addNoteModal.title', 'Add Note')}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                {t(
                  'clinicPatients.addNoteModal.subtitle',
                  'Record clinical observations, visit details, or treatment notes.'
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ width: '34px', height: '34px', padding: 0, borderRadius: '8px' }}
            title={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              maxHeight: 'calc(85vh - 140px)',
              overflowY: 'auto',
            }}
          >
            {/* Top Row: Patient & Note Date */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Patient * Field */}
              <div>
                <label
                  className="form-label"
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '6px',
                    display: 'block',
                    color: 'var(--text-heading, #1e293b)',
                  }}
                >
                  {t('clinicPatients.addNoteModal.patient', 'Patient')}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SearchableSelect
                  options={patientSelectOptions}
                  value={patientId}
                  onChange={(val) => {
                    setPatientId(val);
                    if (validationErrors.patientId) {
                      setValidationErrors((prev) => ({ ...prev, patientId: '' }));
                    }
                  }}
                  placeholder={
                    loadingPatients
                      ? t('common.loading', 'Loading...')
                      : t('clinicPatients.addNoteModal.patientPlaceholder', 'Select patient...')
                  }
                  searchPlaceholder={t(
                    'clinicPatients.searchPlaceholder',
                    'Search by patient name, record #, phone...'
                  )}
                />
                {validationErrors.patientId && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#ef4444',
                      marginTop: '4px',
                      display: 'block',
                      fontWeight: 600,
                    }}
                  >
                    {validationErrors.patientId}
                  </span>
                )}
              </div>

              {/* Note Date * Field */}
              <div>
                <label
                  className="form-label"
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '6px',
                    display: 'block',
                    color: 'var(--text-heading, #1e293b)',
                  }}
                >
                  {t('clinicPatients.addNoteModal.noteDate', 'Note Date')}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    className={`input ${validationErrors.noteDate ? 'is-invalid' : ''}`}
                    value={noteDate}
                    onChange={(e) => {
                      setNoteDate(e.target.value);
                      if (validationErrors.noteDate) {
                        setValidationErrors((prev) => ({ ...prev, noteDate: '' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      fontSize: '13px',
                      paddingLeft: '12px',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted, #64748b)',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  {t('clinicPatients.addNoteModal.noteDateHelp', 'Select the date for this note')}
                </span>
                {validationErrors.noteDate && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#ef4444',
                      marginTop: '2px',
                      display: 'block',
                      fontWeight: 600,
                    }}
                  >
                    {validationErrors.noteDate}
                  </span>
                )}
              </div>
            </div>

            {/* Topic Field */}
            <div>
              <label
                className="form-label"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '6px',
                  display: 'block',
                  color: 'var(--text-heading, #1e293b)',
                }}
              >
                {t('clinicPatients.addNoteModal.topic', 'Topic')}
              </label>
              <input
                type="text"
                className="input"
                placeholder={t(
                  'clinicPatients.addNoteModal.topicPlaceholder',
                  'Enter topic or subject...'
                )}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={255}
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13px',
                  borderColor: topic ? 'var(--primary-400, #38bdf8)' : undefined,
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748b)',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                {t(
                  'clinicPatients.addNoteModal.topicHelp',
                  'Optional: Add a topic or subject for this note to help categorize it.'
                )}
              </span>
            </div>

            {/* Note * Field */}
            <div>
              <label
                className="form-label"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '6px',
                  display: 'block',
                  color: 'var(--text-heading, #1e293b)',
                }}
              >
                {t('clinicPatients.addNoteModal.note', 'Note')}{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className={`input ${validationErrors.note ? 'is-invalid' : ''}`}
                  placeholder={t(
                    'clinicPatients.addNoteModal.notePlaceholder',
                    'Enter a note about this patient...'
                  )}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (validationErrors.note) {
                      setValidationErrors((prev) => ({ ...prev, note: '' }));
                    }
                  }}
                  rows={4}
                  style={{
                    width: '100%',
                    minHeight: '110px',
                    fontSize: '13px',
                    padding: '10px 12px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    borderColor: validationErrors.note ? '#ef4444' : undefined,
                  }}
                />
                {validationErrors.note && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      bottom: '12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #1e293b',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#0f172a',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      pointerEvents: 'none',
                    }}
                  >
                    {validationErrors.note}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748b)',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                {t(
                  'clinicPatients.addNoteModal.noteHelp',
                  "Add detailed notes about the patient's visit, treatment, or any other relevant information."
                )}
              </span>
            </div>

            {/* Audit notice banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(14, 165, 233, 0.06)',
                border: '1px solid rgba(14, 165, 233, 0.2)',
                fontSize: '12px',
                color: 'var(--primary-700, #0369a1)',
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>
                {t(
                  'clinicPatients.addNoteModal.auditNotice',
                  'Each note records the creator and timestamp for audit purposes.'
                )}
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-muted, #f8fafc)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ fontSize: '13px', minHeight: '40px', padding: '0 18px' }}
            >
              {t('clinicPatients.addNoteModal.cancelBtn', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                minHeight: '40px',
                padding: '0 20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid currentColor',
                      borderRightColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.75s linear infinite',
                    }}
                  />
                  <span>{t('clinicPatients.addNoteModal.savingBtn', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <FileText size={15} />
                  <span>{t('clinicPatients.addNoteModal.saveBtn', 'Save Note')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

