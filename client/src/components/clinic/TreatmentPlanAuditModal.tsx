import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  History,
  Clock,
  User,
  ArrowRight,
  Calendar,
  PlusCircle,
  Trash2,
  Edit2,
  RefreshCw,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  clinicOdontogramService,
  TreatmentPlanAuditItem,
} from '../../services/clinicOdontogramService';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { Pagination } from '../common/Pagination';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';
import { Tooltip } from '../common/Tooltip';
import { formatDateTime } from '../../core/utils/dateUtils';

export interface TreatmentPlanAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  initialGroupId?: string;
}

const ACTION_BADGE_MAP: Record<
  string,
  { bg: string; color: string; border: string; icon: React.ReactNode }
> = {
  PLAN_CREATED: {
    bg: 'rgba(13, 148, 136, 0.1)',
    color: '#0f766e',
    border: 'rgba(13, 148, 136, 0.3)',
    icon: <PlusCircle size={13} />,
  },
  PLAN_RENAMED: {
    bg: 'rgba(59, 130, 246, 0.1)',
    color: '#1d4ed8',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: <Edit2 size={13} />,
  },
  PLAN_DELETED: {
    bg: 'rgba(239, 68, 68, 0.1)',
    color: '#b91c1c',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: <Trash2 size={13} />,
  },
  STATUS_CHANGED: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#047857',
    border: 'rgba(16, 185, 129, 0.35)',
    icon: <RefreshCw size={13} />,
  },
  SERVICE_ADDED: {
    bg: 'rgba(13, 148, 136, 0.1)',
    color: '#0f766e',
    border: 'rgba(13, 148, 136, 0.3)',
    icon: <PlusCircle size={13} />,
  },
  SERVICE_UPDATED: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#b45309',
    border: 'rgba(245, 158, 11, 0.35)',
    icon: <Edit2 size={13} />,
  },
  SERVICE_REMOVED: {
    bg: 'rgba(239, 68, 68, 0.1)',
    color: '#b91c1c',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: <Trash2 size={13} />,
  },
  APPOINTMENT_CREATED: {
    bg: 'rgba(99, 102, 241, 0.12)',
    color: '#4338ca',
    border: 'rgba(99, 102, 241, 0.35)',
    icon: <Calendar size={13} />,
  },
  APPOINTMENT_UPDATED: {
    bg: 'rgba(59, 130, 246, 0.1)',
    color: '#1d4ed8',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: <Edit2 size={13} />,
  },
  APPOINTMENT_STATUS_CHANGED: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#b45309',
    border: 'rgba(245, 158, 11, 0.35)',
    icon: <RefreshCw size={13} />,
  },
  APPOINTMENT_DELETED: {
    bg: 'rgba(239, 68, 68, 0.1)',
    color: '#b91c1c',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: <Trash2 size={13} />,
  },
};

export const TreatmentPlanAuditModal: React.FC<TreatmentPlanAuditModalProps> = ({
  isOpen,
  onClose,
  patientId,
  initialGroupId = 'ALL',
}) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { error } = useToast();
  const tenantTz = user?.activeTenant?.settings?.timezone;

  const [audits, setAudits] = useState<TreatmentPlanAuditItem[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Array<{ groupId: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedGroupId(initialGroupId || 'ALL');
      setSelectedAction('ALL');
      setPage(1);
    }
  }, [isOpen, initialGroupId]);

  const fetchAuditHistory = useCallback(async () => {
    if (!isOpen || !patientId) return;
    try {
      setLoading(true);
      const res = await clinicOdontogramService.getTreatmentPlanAuditHistory(patientId, {
        groupId: selectedGroupId,
        action: selectedAction,
        page,
        limit: pageSize,
      });
      setAudits(res.audits || []);
      setTotalItems(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setAvailablePlans(res.availablePlans || []);
    } catch (err: any) {
      console.error('Failed to load treatment plan audit history:', err);
      error(err?.response?.data?.message || t('patientTreatmentPlan.loadFailed', 'Failed to load audit history.'));
    } finally {
      setLoading(false);
    }
  }, [isOpen, patientId, selectedGroupId, selectedAction, page, pageSize, error, t]);

  useEffect(() => {
    fetchAuditHistory();
  }, [fetchAuditHistory]);

  const planFilterOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: t('patientTreatmentPlan.auditAllPlans', 'All Treatment Plans') },
      ...availablePlans.map((p) => ({ value: p.groupId, label: p.name })),
    ],
    [availablePlans, t],
  );

  const actionFilterOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: t('patientTreatmentPlan.auditAllActions', 'All Actions') },
      { value: 'STATUS_CHANGED', label: t('patientTreatmentPlan.auditActions.STATUS_CHANGED', 'Status Updated') },
      { value: 'SERVICE_ADDED', label: t('patientTreatmentPlan.auditActions.SERVICE_ADDED', 'Service Added') },
      { value: 'SERVICE_UPDATED', label: t('patientTreatmentPlan.auditActions.SERVICE_UPDATED', 'Service Updated') },
      { value: 'SERVICE_REMOVED', label: t('patientTreatmentPlan.auditActions.SERVICE_REMOVED', 'Service Removed') },
      { value: 'APPOINTMENT_CREATED', label: t('patientTreatmentPlan.auditActions.APPOINTMENT_CREATED', 'Appointment Created') },
      {
        value: 'APPOINTMENT_UPDATED,APPOINTMENT_STATUS_CHANGED,APPOINTMENT_DELETED',
        label: t('patientTreatmentPlan.auditActions.APPOINTMENT_UPDATED', 'Appointment Edited'),
      },
      {
        value: 'PLAN_CREATED,PLAN_RENAMED,PLAN_DELETED',
        label: t('patientTreatmentPlan.auditActions.PLAN_CREATED', 'Plan Created / Renamed / Deleted'),
      },
    ],
    [t],
  );

  const renderDiffEntries = (oldVals: Record<string, any> | null, newVals: Record<string, any> | null) => {
    if (!oldVals && !newVals) return null;

    const formatObj = (obj: Record<string, any>) =>
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(' • ');

    const oldStr = oldVals ? formatObj(oldVals) : '';
    const newStr = newVals ? formatObj(newVals) : '';

    if (!oldStr && !newStr) return null;

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px' }}>
        {oldStr && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#b91c1c',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <strong>{t('patientTreatmentPlan.auditBeforeLabel', 'Before')}:</strong> {oldStr}
          </span>
        )}
        {oldStr && newStr && <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        {newStr && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#047857',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <strong>{t('patientTreatmentPlan.auditAfterLabel', 'After')}:</strong> {newStr}
          </span>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1080,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '8px' : '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: isMobile ? '94vh' : '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <History size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('patientTreatmentPlan.auditHistoryTitle', 'Treatment Plan Audit History')}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('patientTreatmentPlan.auditHistorySubtitle', 'Complete chronological log of status changes, service edits, and appointment actions')}
              </p>
            </div>
          </div>

          <Tooltip content={t('common.close', 'Close')}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minWidth: '40px',
                minHeight: '40px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={t('common.close', 'Close')}
            >
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <SearchableSelect
            options={planFilterOptions}
            value={selectedGroupId}
            onChange={(val) => {
              setSelectedGroupId(val);
              setPage(1);
            }}
            placeholder={t('patientTreatmentPlan.auditAllPlans', 'All Treatment Plans')}
            icon={<FileText size={14} />}
          />
          <SearchableSelect
            options={actionFilterOptions}
            value={selectedAction}
            onChange={(val) => {
              setSelectedAction(val);
              setPage(1);
            }}
            placeholder={t('patientTreatmentPlan.auditAllActions', 'All Actions')}
            icon={<History size={14} />}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '16px 22px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', gap: '10px', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '13px' }}>{t('common.loading', 'Loading...')}</span>
            </div>
          ) : audits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <History size={34} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 500 }}>
                {t('patientTreatmentPlan.auditNoRecords', 'No audit history recorded for this treatment plan yet.')}
              </div>
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {audits.map((audit) => {
                const badge = ACTION_BADGE_MAP[audit.action] || ACTION_BADGE_MAP.STATUS_CHANGED;
                return (
                  <div
                    key={audit.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.icon}
                        <span>{t(`patientTreatmentPlan.auditActions.${audit.action}`, audit.action)}</span>
                      </span>
                      {audit.treatmentPlanName && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {audit.treatmentPlanName}
                        </span>
                      )}
                    </div>

                    {audit.description && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {audit.description}
                      </div>
                    )}

                    {renderDiffEntries(audit.oldValues, audit.newValues)}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {audit.user?.name || audit.user?.email || 'System'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {formatDateTime(audit.createdAt, { locale: i18n.language, timeZone: tenantTz })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-surface-muted)' }}>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('patientTreatmentPlan.auditAction', 'Action')}
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('patientTreatmentPlan.auditDetails', 'Details')}
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('patientTreatmentPlan.auditPerformedBy', 'Performed By')}
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('patientTreatmentPlan.auditDateTime', 'Date & Time')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((audit) => {
                    const badge = ACTION_BADGE_MAP[audit.action] || ACTION_BADGE_MAP.STATUS_CHANGED;
                    return (
                      <tr key={audit.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.icon}
                              <span>{t(`patientTreatmentPlan.auditActions.${audit.action}`, audit.action)}</span>
                            </span>
                            {audit.treatmentPlanName && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {audit.treatmentPlanName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {audit.description || audit.action}
                          </div>
                          {renderDiffEntries(audit.oldValues, audit.newValues)}
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-main)' }}>
                            <User size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{audit.user?.name || audit.user?.email || 'System'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <Clock size={12} />
                            <span>{formatDateTime(audit.createdAt, { locale: i18n.language, timeZone: tenantTz })}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mandatory Pagination (Rule 11: always render whenever totalItems > 0) */}
        {totalItems > 0 && (
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 16px', flexShrink: 0 }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
