import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';
import { Pagination } from '../common/Pagination';
import { formatDate, getTodayDateString } from '../../core/utils/dateUtils';
import {
  X,
  Calendar,
  FileText,
  UserCheck,
  ShieldCheck,
  History,
  Search,
  RefreshCw,
  Copy,
  Check,
  User,
  Clock,
  AlertCircle,
  FilePlus,
  ArrowRight,
} from 'lucide-react';

export interface PatientOptionItem {
  id: string;
  recordNumber: string;
  firstName: string;
  fatherLastName?: string | null;
  motherLastName?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
}

export interface PatientNoteItem {
  id: string;
  patientId: string;
  createdById: string;
  noteDate: string;
  topic?: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface AddPatientNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string | null;
  patientsList?: PatientOptionItem[];
}

const DEFAULT_PATIENTS_LIST: PatientOptionItem[] = [];

export const AddPatientNoteModal: React.FC<AddPatientNoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  patientsList = DEFAULT_PATIENTS_LIST,
}) => {
  const { t } = useTranslation();
  const { success, error } = useToast();

  const [allPatients, setAllPatients] = useState<PatientOptionItem[]>(patientsList);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);

  // Form states
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [noteDate, setNoteDate] = useState<string>(getTodayDateString());
  const [topic, setTopic] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Existing notes history states
  const [existingNotes, setExistingNotes] = useState<PatientNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [notesSearch, setNotesSearch] = useState<string>('');
  const [notesPage, setNotesPage] = useState<number>(1);
  const [notesLimit, setNotesLimit] = useState<number>(5);
  const [notesTotal, setNotesTotal] = useState<number>(0);
  const [notesTotalPages, setNotesTotalPages] = useState<number>(1);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Mobile viewport tracking
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'history'>('form');

  // Track window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch patient notes history
  const fetchNotes = useCallback(
    async (pId: string, pageNum: number, pageSize: number, searchKeyword: string) => {
      if (!pId) {
        setExistingNotes([]);
        setNotesTotal(0);
        setNotesTotalPages(1);
        return;
      }
      setLoadingNotes(true);
      try {
        const params = new URLSearchParams();
        params.append('page', pageNum.toString());
        params.append('limit', pageSize.toString());
        if (searchKeyword.trim()) {
          params.append('search', searchKeyword.trim());
        }
        const res = await api.get(`/clinic/patients/${pId}/notes?${params.toString()}`);
        setExistingNotes(res.data?.notes || []);
        setNotesTotal(res.data?.total || 0);
        setNotesTotalPages(res.data?.totalPages || 1);
      } catch (err: any) {
        console.warn('Failed to fetch patient existing notes:', err);
        setExistingNotes([]);
        setNotesTotal(0);
        setNotesTotalPages(1);
      } finally {
        setLoadingNotes(false);
      }
    },
    []
  );

  // Fetch notes when patientId, page, or limit changes
  useEffect(() => {
    if (isOpen && patientId) {
      fetchNotes(patientId, notesPage, notesLimit, notesSearch);
    } else if (!patientId) {
      setExistingNotes([]);
      setNotesTotal(0);
      setNotesTotalPages(1);
    }
  }, [isOpen, patientId, notesPage, notesLimit, fetchNotes]);

  // Debounced search on notes
  const searchTimeoutRef = useRef<any>(null);
  const handleSearchChange = (val: string) => {
    setNotesSearch(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setNotesPage(1);
      if (patientId) {
        fetchNotes(patientId, 1, notesLimit, val);
      }
    }, 350);
  };

  // Reset or load initial patient when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeId = initialPatientId || '';
      setPatientId(activeId);
      setNoteDate(getTodayDateString());
      setTopic('');
      setNote('');
      setValidationErrors({});
      setNotesSearch('');
      setNotesPage(1);
      setActiveMobileTab('form');
      setCopiedNoteId(null);

      // If patient list is provided, use it; otherwise fetch active patients if empty
      if (patientsList && patientsList.length > 0) {
        setAllPatients(patientsList);
      } else if (allPatients.length === 0) {
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
      }
    } else {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [isOpen, initialPatientId]);

  // Selected patient details
  const selectedPatient = useMemo(() => {
    if (!patientId) return null;
    return allPatients.find((p) => p.id === patientId) || null;
  }, [allPatients, patientId]);

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

  // Handle Copy / Reference Note into Editor
  const handleCopyNote = (item: PatientNoteItem) => {
    const formattedDate = formatDate(item.noteDate);
    const quoteHeader = item.topic
      ? `[${formattedDate} - ${item.topic}]`
      : `[${formattedDate}]`;
    const snippet = `${quoteHeader}\n${item.note}`;

    setNote((prev) => {
      if (!prev.trim()) return snippet;
      return `${prev.trim()}\n\n${snippet}`;
    });

    setCopiedNoteId(item.id);
    setTimeout(() => {
      setCopiedNoteId(null);
    }, 2000);

    success(t('clinicPatients.addNoteModal.copiedToNote', 'Note text copied to editor'));

    if (isMobileScreen) {
      setActiveMobileTab('form');
    }
  };

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
        padding: isMobileScreen ? '10px' : '16px',
      }}
      onClick={onClose}
    >
      <div
        className="add-note-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
                flexShrink: 0,
              }}
            >
              <FileText size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-heading, #0f172a)',
                    lineHeight: '1.2',
                  }}
                >
                  {t('clinicPatients.addNoteModal.title', 'Add Note')}
                </h2>
                {selectedPatient && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(2, 132, 199, 0.08)',
                      border: '1px solid rgba(2, 132, 199, 0.2)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--primary-700, #0369a1)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>#{selectedPatient.recordNumber}</span>
                    <span>•</span>
                    <span>{selectedPatient.firstName} {selectedPatient.fatherLastName || ''}</span>
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted, #64748b)',
                  display: 'block',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
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
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '8px',
              flexShrink: 0,
            }}
            title={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Segmented Switcher (< 768px) */}
        {isMobileScreen && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-muted, #f8fafc)',
              padding: '6px 10px',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMobileTab('form')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor:
                  activeMobileTab === 'form' ? 'var(--card-bg, #ffffff)' : 'transparent',
                color:
                  activeMobileTab === 'form'
                    ? 'var(--primary-600, #0284c7)'
                    : 'var(--text-muted, #64748b)',
                boxShadow:
                  activeMobileTab === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={15} />
              <span>{t('clinicPatients.addNoteModal.tabForm', 'New Note')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMobileTab('history')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor:
                  activeMobileTab === 'history' ? 'var(--card-bg, #ffffff)' : 'transparent',
                color:
                  activeMobileTab === 'history'
                    ? 'var(--primary-600, #0284c7)'
                    : 'var(--text-muted, #64748b)',
                boxShadow:
                  activeMobileTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <History size={15} />
              <span>{t('clinicPatients.addNoteModal.tabHistory', 'Existing Notes')}</span>
              {notesTotal > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    color: 'var(--primary-700, #0369a1)',
                  }}
                >
                  {notesTotal}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Modal Main Split Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* ════════════ LEFT PANE: CREATE NOTE FORM ════════════ */}
          {(!isMobileScreen || activeMobileTab === 'form') && (
            <div
              style={{
                width: isMobileScreen ? '100%' : '52%',
                borderRight: isMobileScreen ? 'none' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflowY: 'auto',
                backgroundColor: 'var(--card-bg, #ffffff)',
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Top Row: Patient & Note Date */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobileScreen ? '1fr' : '1.2fr 0.8fr',
                      gap: '14px',
                    }}
                  >
                    {/* Patient Field */}
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
                          setNotesPage(1);
                          setNotesSearch('');
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

                    {/* Note Date Field */}
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

                  {/* Note Field */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <label
                        className="form-label"
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          margin: 0,
                          color: 'var(--text-heading, #1e293b)',
                        }}
                      >
                        {t('clinicPatients.addNoteModal.note', 'Note')}{' '}
                        <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {isMobileScreen && notesTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveMobileTab('history')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-600, #0284c7)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0,
                          }}
                        >
                          <History size={12} />
                          <span>
                            {t('clinicPatients.addNoteModal.tabHistory', 'Existing Notes')} ({notesTotal})
                          </span>
                        </button>
                      )}
                    </div>
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
                        rows={isMobileScreen ? 4 : 5}
                        style={{
                          width: '100%',
                          minHeight: isMobileScreen ? '100px' : '130px',
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

                {/* Left Pane Form Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-muted, #f8fafc)',
                    flexShrink: 0,
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
          )}

          {/* ════════════ RIGHT PANE: PATIENT EXISTING NOTES ════════════ */}
          {(!isMobileScreen || activeMobileTab === 'history') && (
            <div
              style={{
                width: isMobileScreen ? '100%' : '48%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                overflow: 'hidden',
              }}
            >
              {/* History Pane Header */}
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={16} style={{ color: 'var(--indigo-600, #6366f1)' }} />
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text-heading, #0f172a)',
                      }}
                    >
                      {t('clinicPatients.addNoteModal.historyTitle', 'Clinical Notes History')}
                    </h3>
                    {patientId && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--indigo-600, #6366f1)',
                        }}
                      >
                        {t('clinicPatients.addNoteModal.notesCount', {
                          count: notesTotal,
                          defaultValue: `${notesTotal} notes`,
                        })}
                      </span>
                    )}
                  </div>

                  {patientId && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => fetchNotes(patientId, notesPage, notesLimit, notesSearch)}
                      title={t('clinicPatients.addNoteModal.refreshNotes', 'Refresh notes')}
                      style={{
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <RefreshCw size={13} className={loadingNotes ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>

                {/* History Search Bar */}
                {patientId && (
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted, #94a3b8)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder={t(
                        'clinicPatients.addNoteModal.searchNotesPlaceholder',
                        'Search past notes by topic or content...'
                      )}
                      value={notesSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: '32px',
                        fontSize: '12px',
                        paddingLeft: '32px',
                        paddingRight: notesSearch ? '28px' : '10px',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                      }}
                    />
                    {notesSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotesSearch('');
                          setNotesPage(1);
                          fetchNotes(patientId, 1, notesLimit, '');
                        }}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* History Cards Scrollable Area */}
              <div
                style={{
                  padding: '16px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {!patientId ? (
                  /* State 1: No patient selected */
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      borderRadius: '12px',
                      border: '1px dashed var(--border-color)',
                      margin: 'auto 0',
                    }}
                  >
                    <UserCheck
                      size={32}
                      style={{
                        margin: '0 auto 10px',
                        color: 'var(--text-muted, #94a3b8)',
                        opacity: 0.7,
                      }}
                    />
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        margin: '0 0 4px',
                        color: 'var(--text-heading, #1e293b)',
                      }}
                    >
                      {t(
                        'clinicPatients.addNoteModal.noPatientSelected',
                        'Select a patient above to view their previous clinical notes.'
                      )}
                    </p>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                      {t(
                        'clinicPatients.addNoteModal.patientPlaceholder',
                        'Select patient from the list on the left.'
                      )}
                    </span>
                  </div>
                ) : loadingNotes ? (
                  /* State 2: Loading */
                  <div style={{ padding: '48px 0', textAlign: 'center', margin: 'auto 0' }}>
                    <RefreshCw
                      size={24}
                      className="animate-spin"
                      style={{
                        margin: '0 auto 10px',
                        color: 'var(--primary-600, #0284c7)',
                      }}
                    />
                    <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                      {t('clinicPatients.addNoteModal.loadingNotes', 'Loading patient notes...')}
                    </p>
                  </div>
                ) : existingNotes.length === 0 ? (
                  /* State 3: Empty (0 notes recorded) */
                  <div
                    style={{
                      padding: '36px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      borderRadius: '12px',
                      border: '1px dashed var(--border-color)',
                      margin: 'auto 0',
                    }}
                  >
                    <FileText
                      size={32}
                      style={{
                        margin: '0 auto 10px',
                        color: 'var(--indigo-600, #6366f1)',
                        opacity: 0.8,
                      }}
                    />
                    <h4
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        margin: '0 0 6px',
                        color: 'var(--text-heading, #0f172a)',
                      }}
                    >
                      {notesSearch
                        ? t(
                            'clinicPatients.addNoteModal.noSearchMatch',
                            'No notes match your search.'
                          )
                        : t(
                            'clinicPatients.addNoteModal.noNotesFound',
                            'No previous clinical notes recorded for this patient.'
                          )}
                    </h4>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #64748b)',
                        margin: 0,
                      }}
                    >
                      {notesSearch
                        ? t('common.tryAnotherSearch', 'Try a different keyword or clear search.')
                        : t(
                            'clinicPatients.addNoteModal.noNotesHelp',
                            "This will be the first note added to this patient's record."
                          )}
                    </p>
                  </div>
                ) : (
                  /* State 4: List of Note Cards */
                  existingNotes.map((item) => {
                    const isCopied = copiedNoteId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="add-note-card-item"
                      >
                        {/* Note Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {/* Date Badge */}
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                color: 'var(--primary-700, #0369a1)',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <Calendar size={12} />
                              <span>{formatDate(item.noteDate)}</span>
                            </span>

                            {/* Topic Tag if present */}
                            {item.topic && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                  color: 'var(--indigo-600, #6366f1)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                {item.topic}
                              </span>
                            )}
                          </div>

                          {/* Quick Reference / Copy Action Button */}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleCopyNote(item)}
                            title={t(
                              'clinicPatients.addNoteModal.copyToNote',
                              'Copy to Note'
                            )}
                            style={{
                              padding: '4px 8px',
                              height: '26px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isCopied ? '#16a34a' : 'var(--primary-600, #0284c7)',
                              backgroundColor: isCopied
                                ? 'rgba(22, 163, 74, 0.08)'
                                : 'rgba(2, 132, 199, 0.06)',
                              flexShrink: 0,
                            }}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>
                              {isCopied
                                ? t('common.copied', 'Copied')
                                : t('clinicPatients.addNoteModal.copyToNote', 'Copy to Note')}
                            </span>
                          </button>
                        </div>

                        {/* Note Card Body */}
                        <div
                          style={{
                            fontSize: '13px',
                            lineHeight: '1.5',
                            color: 'var(--text-main, #1e293b)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            backgroundColor: 'var(--bg-muted, #f8fafc)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(226, 232, 240, 0.7)',
                          }}
                        >
                          {item.note}
                        </div>

                        {/* Note Card Footer: Author & Timestamp */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            color: 'var(--text-muted, #64748b)',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '-2px',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <User size={12} />
                            <span>
                              {item.createdBy?.name ||
                                t('clinicPatients.clinicalHistoryModal.createdBy', 'Doctor')}
                            </span>
                          </span>

                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            <span>
                              {t('clinicPatients.addNoteModal.createdOn', 'Created on')}{' '}
                              {formatDate(item.createdAt)}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* History Pane Footer: Rule 11 Table Pagination */}
              {notesTotal > 0 && (
                <div
                  style={{
                    padding: '8px 14px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    flexShrink: 0,
                  }}
                >
                  <Pagination
                    currentPage={notesPage}
                    totalPages={notesTotalPages}
                    totalItems={notesTotal}
                    pageSize={notesLimit}
                    pageSizeOptions={[5, 10, 25]}
                    onPageChange={(p) => setNotesPage(p)}
                    onPageSizeChange={(sz) => {
                      setNotesLimit(sz);
                      setNotesPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
