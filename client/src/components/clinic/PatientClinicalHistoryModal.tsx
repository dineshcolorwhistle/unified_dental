import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { clinicOdontogramService } from '../../services/clinicOdontogramService';
import { useToast } from '../../core/context/ToastContext';
import { useAuth } from '../../core/context/AuthContext';
import { Pagination } from '../common/Pagination';
import { ToothIcon } from '../common/ToothIcon';
import { formatDate, formatDateTime } from '../../core/utils/dateUtils';
import {
  X,
  History,
  FilePlus,
  Search,
  Calendar,
  Clock,
  User,
  Trash2,
  AlertCircle,
  Tag,
  ShieldCheck,
  RefreshCw,
  Phone,
  FileText,
  ClipboardList,
} from 'lucide-react';

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

interface PatientClinicalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    recordNumber: string;
    firstName: string;
    fatherLastName?: string | null;
    motherLastName?: string | null;
    phoneNumber?: string | null;
    phoneCountryCode?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    branch?: {
      id: string;
      name: string;
    } | null;
  } | null;
  onOpenAddNote: (patientId: string) => void;
}

export const PatientClinicalHistoryModal: React.FC<PatientClinicalHistoryModalProps> = ({
  isOpen,
  onClose,
  patient,
  onOpenAddNote,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();
  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const [notes, setNotes] = useState<PatientNoteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasTreatments, setHasTreatments] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Note delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Check if current user is Tenant Admin
  const isTenantAdmin = Boolean(
    user?.isSuperAdmin ||
      user?.roles?.some((r: string) => {
        const lower = r.toLowerCase();
        return (
          lower === 'tenant-admin' ||
          lower.includes('tenant administrator') ||
          lower.includes('tenant admin')
        );
      })
  );

  const fetchHistory = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/clinic/patients/${patient.id}/notes?${params.toString()}`);
      setNotes(res.data?.notes || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalCount(res.data?.total || 0);
    } catch (err: any) {
      console.error('Failed to load clinical history notes:', err);
      const msg =
        err.response?.data?.message ||
        t(
          'clinicPatients.clinicalHistoryModal.loadFailed',
          'Failed to load clinical history notes.'
        );
      errorRef.current(msg);
    } finally {
      setLoading(false);
    }
  }, [patient?.id, page, limit, search, t]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && patient?.id) {
      fetchHistory();
      // Check if patient has any treatments recorded on the odontogram
      clinicOdontogramService
        .getPatientOdontogram(patient.id)
        .then((res) => {
          if (isMounted) {
            setHasTreatments(Boolean(res?.treatments && res.treatments.length > 0));
          }
        })
        .catch((err) => {
          console.warn('Could not fetch patient odontogram treatments:', err);
          if (isMounted) {
            setHasTreatments(false);
          }
        });
    } else if (!isOpen) {
      setNotes([]);
      setSearch('');
      setPage(1);
      setHasTreatments(false);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, patient?.id, fetchHistory]);

  const handleDeleteNote = async (noteId: string) => {
    if (!patient?.id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/clinic/patients/${patient.id}/notes/${noteId}`);
      success(
        t(
          'clinicPatients.clinicalHistoryModal.deleteSuccess',
          'Clinical note deleted successfully.'
        )
      );
      setDeleteTargetId(null);
      fetchHistory();
    } catch (err: any) {
      error(
        err.response?.data?.message ||
          t(
            'clinicPatients.clinicalHistoryModal.deleteFailed',
            'Failed to delete clinical note.'
          )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !patient) return null;

  const patientFullName = [patient.firstName, patient.fatherLastName, patient.motherLastName]
    .filter(Boolean)
    .join(' ');

  // Format date and time for audit
  const formatAuditDateTime = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const formatNoteDateOnly = (dateString: string) => {
    return formatDate(dateString, { format: 'medium' });
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
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
          maxWidth: '840px',
          maxHeight: '90vh',
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
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--indigo-600, #6366f1)',
              }}
            >
              <History size={22} />
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
                {t('clinicPatients.clinicalHistoryModal.title', 'Clinical History')}
              </h2>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #64748b)',
                  marginTop: '2px',
                }}
              >
                {patientFullName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* 1. View Odontogram Button */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                onClose();
                navigate(`/clinic/patients/${patient.id}/odontogram`);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: '8px',
              }}
              title={t('clinicPatients.clinicalHistoryModal.viewOdontogram', 'View Odontogram')}
            >
              <ToothIcon size={15} />
              <span>{t('clinicPatients.clinicalHistoryModal.viewOdontogram', 'View Odontogram')}</span>
            </button>

            {/* 2. Treatment Plan Button (shown only if treatments exist) */}
            {hasTreatments && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  onClose();
                  navigate(`/clinic/patients/${patient.id}/treatment-plan`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}
                title={t('clinicPatients.clinicalHistoryModal.treatmentPlan', 'Treatment Plan')}
              >
                <ClipboardList size={15} />
                <span>{t('clinicPatients.clinicalHistoryModal.treatmentPlan', 'Treatment Plan')}</span>
              </button>
            )}

            {/* 3. Existing Add Note Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenAddNote(patient.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: '8px',
              }}
            >
              <FilePlus size={16} />
              <span>{t('clinicPatients.clinicalHistoryModal.addNoteBtn', 'Add Note')}</span>
            </button>

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
        </div>

        {/* Search & Stats Bar */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--bg-muted, #f8fafc)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '420px' }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #94a3b8)',
                pointerEvents: 'none',
                display: 'flex',
              }}
            >
              <Search size={15} />
            </span>
            <input
              type="text"
              className="input"
              placeholder={t(
                'clinicPatients.clinicalHistoryModal.searchPlaceholder',
                'Search notes by topic or content...'
              )}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                paddingLeft: '34px',
                height: '36px',
                fontSize: '13px',
                width: '100%',
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
              }}
            >
              {t('clinicPatients.clinicalHistoryModal.totalNotes', 'Total Notes')}:{' '}
              <strong style={{ color: 'var(--text-heading, #0f172a)' }}>{totalCount}</strong>
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={fetchHistory}
              title={t('common.refresh', 'Refresh')}
              style={{ padding: '6px', borderRadius: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Modal Body: Notes Timeline List */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw
                size={24}
                className="animate-spin"
                style={{ margin: '0 auto 12px', color: 'var(--primary-600, #0284c7)' }}
              />
              <p style={{ fontSize: '13px', margin: 0 }}>
                {t('clinicPatients.clinicalHistoryModal.loading', 'Loading clinical history...')}
              </p>
            </div>
          ) : notes.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                borderRadius: '12px',
                border: '1px dashed var(--border-color)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--indigo-600, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <FileText size={24} />
              </div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  margin: '0 0 6px',
                  color: 'var(--text-heading, #0f172a)',
                }}
              >
                {t(
                  'clinicPatients.clinicalHistoryModal.emptyTitle',
                  'No Clinical Notes Recorded'
                )}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted, #64748b)',
                  margin: '0 0 16px',
                  maxWidth: '420px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                {t(
                  'clinicPatients.clinicalHistoryModal.emptyHelp',
                  'No clinical notes have been added for this patient yet. Click "+ Add Note" to create the first note.'
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onOpenAddNote(patient.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <FilePlus size={15} />
                <span>
                  {t('clinicPatients.clinicalHistoryModal.addNoteBtn', 'Add Note')}
                </span>
              </button>
            </div>
          ) : (
            notes.map((item) => {
              const canDelete =
                isTenantAdmin || (user?.id && item.createdById === user.id);

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Note Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)',
                      paddingBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Note Date Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(14, 165, 233, 0.1)',
                          color: 'var(--primary-700, #0369a1)',
                        }}
                      >
                        <Calendar size={13} />
                        <span>{formatNoteDateOnly(item.noteDate)}</span>
                      </span>

                      {/* Topic Badge if exists */}
                      {item.topic && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--indigo-700, #4338ca)',
                          }}
                        >
                          <Tag size={12} />
                          <span>{item.topic}</span>
                        </span>
                      )}
                    </div>

                    {/* Delete action button */}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setDeleteTargetId(item.id)}
                        title={t(
                          'clinicPatients.clinicalHistoryModal.deleteNoteTitle',
                          'Delete Clinical Note'
                        )}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '6px',
                          color: '#ef4444',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Note Content Body */}
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-body, #334155)',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.note}
                  </div>

                  {/* Creator and Audit Information Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      paddingTop: '8px',
                      borderTop: '1px dashed var(--border-color, #e2e8f0)',
                      fontSize: '11px',
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} style={{ color: 'var(--primary-600, #0284c7)' }} />
                      <span>
                        {t('clinicPatients.clinicalHistoryModal.createdBy', 'Created by')}:{' '}
                        <strong style={{ color: 'var(--text-heading, #1e293b)' }}>
                          {item.createdBy?.name || item.createdBy?.email || 'Staff'}
                        </strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>
                        {t('clinicPatients.clinicalHistoryModal.onDate', 'on')}{' '}
                        {formatAuditDateTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Pagination Footer (Rule 11: Render when totalCount > 0) */}
        {totalCount > 0 && (
          <div
            style={{
              padding: '10px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-muted, #f8fafc)',
            }}
          >
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={limit}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(newSize) => {
                setLimit(newSize);
                setPage(1);
              }}
              totalItems={totalCount}
            />
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTargetId && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1070,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: 'var(--card-bg, #ffffff)',
                borderRadius: '14px',
                padding: '20px 24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertCircle size={20} />
                </div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-heading)',
                  }}
                >
                  {t(
                    'clinicPatients.clinicalHistoryModal.deleteNoteTitle',
                    'Delete Clinical Note'
                  )}
                </h3>
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted, #64748b)',
                  margin: '0 0 18px',
                  lineHeight: '1.5',
                }}
              >
                {t(
                  'clinicPatients.clinicalHistoryModal.deleteNoteConfirm',
                  'Are you sure you want to delete this clinical note? This action cannot be undone.'
                )}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isDeleting}
                  onClick={() => setDeleteTargetId(null)}
                  style={{ fontSize: '13px' }}
                >
                  {t('clinicPatients.addNoteModal.cancelBtn', 'Cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={isDeleting}
                  onClick={() => handleDeleteNote(deleteTargetId)}
                  style={{
                    fontSize: '13px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {isDeleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

