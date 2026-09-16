import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Eye,
  RefreshCw,
  ChevronRight,
  Inbox,
  User,
  Cpu,
  UserCheck,
  Stethoscope,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import {
  workOrderService,
  LabAdminDashboardData,
  LabAdminVerificationAlertItem,
  LabAdminInProgressItem,
  LabAdminVerificationItem,
} from '../../services/workOrderService';
import { VerifyWorkOrderModal } from '../../components/lab/VerifyWorkOrderModal';
import { ViewWorkOrderModal } from '../../components/lab/ViewWorkOrderModal';

export const LabAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<LabAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [verifyModal, setVerifyModal] = useState<{
    open: boolean;
    workOrderId: string;
    folioNumber: string;
    patient: string;
    processId: string;
    processName: string;
    processType: string;
  } | null>(null);

  const [detailModalWOId, setDetailModalWOId] = useState<string | null>(null);
  const [startingProcessId, setStartingProcessId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await workOrderService.getLabAdminDashboard();
      setData(result);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      if (!silent) {
        toast.error(err?.response?.data?.message || t('dashboard.labAdmin.loadFailed'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleStartVerification = async (workOrderId: string, processId: string) => {
    setStartingProcessId(processId);
    try {
      await workOrderService.startProcess(workOrderId, processId);
      toast.success(t('dashboard.labAdmin.verificationStarted'));
      fetchDashboard(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('dashboard.labAdmin.actionFailed'));
    } finally {
      setStartingProcessId(null);
    }
  };

  const handleOpenVerifyModal = (item: LabAdminVerificationItem) => {
    setVerifyModal({
      open: true,
      workOrderId: item.workOrderId,
      folioNumber: item.folioNumber,
      patient: item.patient || '',
      processId: item.processId,
      processName: item.processName,
      processType: item.processType,
    });
  };

  const handleVerifyOutcome = async () => {
    setVerifyModal(null);
    fetchDashboard(true);
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Admin';

  if (loading && !data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '300px', color: 'var(--text-muted)', fontSize: '15px',
      }}>
        <RefreshCw size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
        {t('dashboard.labAdmin.loading')}
      </div>
    );
  }

  const stats = data?.stats || { activeOrders: 0, pendingVerifications: 0, pendingTechSteps: 0, completedToday: 0 };
  const alerts = data?.pendingVerificationAlerts || [];
  const inProgress = data?.inProgressOrders || [];
  const verifications = data?.verificationOrders || [];

  const kpiCards = [
    {
      label: t('dashboard.labAdmin.activeOrders'),
      value: stats.activeOrders,
      icon: <Activity size={22} />,
      color: 'var(--primary-600)',
      bg: 'var(--badge-primary-bg)',
      borderColor: 'var(--primary-400)',
    },
    {
      label: t('dashboard.labAdmin.pendingVerifications'),
      value: stats.pendingVerifications,
      icon: <ShieldCheck size={22} />,
      color: 'var(--emerald-500)',
      bg: 'var(--badge-success-bg)',
      borderColor: 'var(--emerald-400)',
    },
    {
      label: t('dashboard.labAdmin.pendingTechSteps'),
      value: stats.pendingTechSteps,
      icon: <Clock size={22} />,
      color: 'var(--amber-500)',
      bg: 'var(--badge-warning-bg)',
      borderColor: 'var(--amber-400)',
    },
    {
      label: t('dashboard.labAdmin.completedToday'),
      value: stats.completedToday,
      icon: <CheckCircle2 size={22} />,
      color: 'var(--sky-500)',
      bg: 'var(--badge-info-bg)',
      borderColor: 'var(--sky-400)',
    },
  ];

  const getStatusBadge = (processType: string) => {
    if (processType === 'EXTERNAL_VERIFICATION') {
      return (
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 9px',
          borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
          backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
          <ShieldCheck size={12} />
          {t('dashboard.labAdmin.externalVerification')}
        </span>
      );
    }
    return (
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '3px 9px',
        borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
        backgroundColor: 'rgba(147, 51, 234, 0.12)', color: '#9333ea',
        border: '1px solid rgba(147, 51, 234, 0.25)',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        <ShieldCheck size={12} />
        {t('dashboard.labAdmin.internalVerification')}
      </span>
    );
  };

  const getStepStatusBadge = (status: string) => {
    if (status === 'IN_PROGRESS') {
      return (
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '12px', backgroundColor: 'var(--badge-success-bg)',
          color: 'var(--emerald-600)', border: '1px solid var(--emerald-200)',
          whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
          {t('dashboard.labAdmin.statusInProgress')}
        </span>
      );
    }
    return (
      <span style={{
        fontSize: '10px', fontWeight: 600, padding: '2px 8px',
        borderRadius: '12px', backgroundColor: 'var(--badge-warning-bg)',
        color: 'var(--amber-600)', border: '1px solid var(--amber-200)',
        whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
        {t('dashboard.labAdmin.statusNotStarted')}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* ─── Pending Verification Alerts (Unified Single Card) ─── */}
      {alerts.length > 0 && (
        <div style={{
          marginBottom: '28px',
          borderRadius: '16px',
          border: '1px solid rgba(147, 51, 234, 0.22)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 4px 20px -2px rgba(147, 51, 234, 0.08)',
          overflow: 'hidden',
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)',
            borderBottom: '1px solid rgba(147, 51, 234, 0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                color: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: 'var(--text-heading)',
                    margin: 0,
                    fontFamily: 'var(--font-heading)',
                  }}>
                    {t('dashboard.labAdmin.pendingVerificationAlerts')}
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    minWidth: '20px',
                    textAlign: 'center',
                    boxShadow: '0 2px 6px rgba(147, 51, 234, 0.35)',
                  }}>
                    {alerts.length}
                  </span>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('dashboard.labAdmin.alertSubtitle')}
                </p>
              </div>
            </div>

            {/* Live Attention Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: 'var(--amber-600)',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                display: 'inline-block',
                boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.25)',
              }} />
              <span>{t('dashboard.labAdmin.actionRequired')}</span>
            </div>
          </div>

          {/* List of WOs inside the single card */}
          <div style={{
            maxHeight: alerts.length > 4 ? '360px' : 'none',
            overflowY: alerts.length > 4 ? 'auto' : 'visible',
            paddingRight: alerts.length > 4 ? '4px' : '0',
          }}>
            {alerts.map((alert: LabAdminVerificationAlertItem, index: number) => (
              <div
                key={`${alert.workOrderId}-${alert.processId}`}
                style={{
                  padding: '14px 20px',
                  borderBottom: index < alerts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Left Side: 2-line layout (Line 1: Identifiers; Line 2: Details) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minWidth: '280px',
                  flex: '1 1 auto',
                }}>
                  {/* Line 1: Folio + Patient + Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#2563eb',
                      fontFamily: 'monospace',
                      letterSpacing: '0.02em',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <FileText size={12} />
                      {alert.folioNumber}
                    </span>

                    <span style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-heading)',
                      fontFamily: 'var(--font-heading)',
                    }}>
                      {alert.patient || '—'}
                    </span>

                    {getStatusBadge(alert.processType)}

                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '5px',
                      backgroundColor: 'var(--badge-warning-bg)',
                      color: 'var(--amber-600)',
                      border: '1px solid var(--amber-200)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                      {t('dashboard.labAdmin.statusNotStarted')}
                    </span>
                  </div>

                  {/* Line 2: Structured Details Chips */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={12} style={{ color: 'var(--primary-600)' }} />
                      <span style={{ color: 'var(--text-muted)' }}>{t('dashboard.labAdmin.stage')}:</span>
                      <strong style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{alert.processName}</strong>
                    </span>

                    <span style={{ color: 'var(--border-color)' }}>•</span>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <UserCheck size={12} style={{ color: '#9333ea' }} />
                      <span style={{ color: 'var(--text-muted)' }}>{t('dashboard.labAdmin.assignedEvaluator')}:</span>
                      <strong style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{alert.evaluatorName || '—'}</strong>
                    </span>

                    {alert.doctorName && (
                      <>
                        <span style={{ color: 'var(--border-color)' }}>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Stethoscope size={12} style={{ color: '#0ea5e9' }} />
                          <span style={{ color: 'var(--text-muted)' }}>{t('dashboard.labAdmin.doctor')}:</span>
                          <strong style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{alert.doctorName}</strong>
                        </span>
                      </>
                    )}

                    {alert.prosthesisName && (
                      <>
                        <span style={{ color: 'var(--border-color)' }}>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Layers size={12} style={{ color: '#10b981' }} />
                          <span style={{ color: 'var(--text-muted)' }}>{t('dashboard.labAdmin.prosthesis')}:</span>
                          <span style={{ color: 'var(--text-heading)', fontWeight: 600 }}>{alert.prosthesisName}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Side: Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setDetailModalWOId(alert.workOrderId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-400)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }}
                  >
                    <Eye size={14} />
                    <span>{t('dashboard.labAdmin.viewWO')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartVerification(alert.workOrderId, alert.processId)}
                    disabled={startingProcessId === alert.processId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 16px',
                      borderRadius: '7px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                      color: '#ffffff',
                      cursor: startingProcessId === alert.processId ? 'wait' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      opacity: startingProcessId === alert.processId ? 0.7 : 1,
                      boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (startingProcessId !== alert.processId) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.45)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 189, 248, 0.3)';
                    }}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>{t('dashboard.labAdmin.startVerification')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '18px 20px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              borderLeft: `4px solid ${kpi.borderColor}`,
              transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              backgroundColor: kpi.bg, color: kpi.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{
                fontSize: '28px', fontWeight: 800, color: 'var(--text-main)',
                lineHeight: 1.1,
              }}>
                {kpi.value}
              </div>
              <div style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px',
              }}>
                {kpi.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Two Column Layout: In-Progress & Verification ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
      }}>
        {/* In-Progress Work Orders */}
        <div style={{
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-muted)',
          }}>
            <Activity size={18} style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('dashboard.labAdmin.inProgressWorkOrders')}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '10px', backgroundColor: 'var(--badge-info-bg)',
              color: 'var(--sky-600)', minWidth: '20px', textAlign: 'center',
            }}>
              {inProgress.length}
            </span>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px' }}>
            {inProgress.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px',
                color: 'var(--text-muted)',
              }}>
                <Inbox size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {t('dashboard.labAdmin.noInProgressOrders')}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {t('dashboard.labAdmin.noInProgressDesc')}
                </div>
              </div>
            ) : (
              inProgress.map((item: LabAdminInProgressItem) => (
                <div
                  key={item.workOrderId}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '8px',
                    backgroundColor: 'var(--bg-card)',
                    transition: 'border-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDetailModalWOId(item.workOrderId)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                        borderRadius: '8px', backgroundColor: 'var(--badge-primary-bg)',
                        color: 'var(--primary-600)', fontFamily: 'monospace',
                      }}>
                        {item.folioNumber}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.patient || '—'}
                      </span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {item.doctorName && <>{t('dashboard.labAdmin.doctor')}: <strong>{item.doctorName}</strong> • </>}
                    {item.prosthesisName && <>{item.prosthesisName}</>}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    fontSize: '12px', color: 'var(--text-muted)',
                  }}>
                    <span style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {t('dashboard.labAdmin.currentStep')}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {t('dashboard.labAdmin.stepN', { n: item.currentStepSequence })}: {item.currentStepName}
                    </span>
                    {getStepStatusBadge(item.currentStepStatus)}
                    {item.technicianName && (
                      <span style={{ marginLeft: 'auto', fontSize: '11px' }}>
                        {item.technicianName}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Verification Work Orders */}
        <div style={{
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-muted)',
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--emerald-500)' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('dashboard.labAdmin.workOrdersInVerification')}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px',
              borderRadius: '10px', backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--emerald-600)', minWidth: '20px', textAlign: 'center',
            }}>
              {verifications.length}
            </span>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px' }}>
            {verifications.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px',
                color: 'var(--text-muted)',
              }}>
                <CheckCircle2 size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {t('dashboard.labAdmin.noVerificationOrders')}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {t('dashboard.labAdmin.noVerificationDesc')}
                </div>
              </div>
            ) : (
              verifications.map((item: LabAdminVerificationItem) => (
                <div
                  key={`${item.workOrderId}-${item.processId}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '8px',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '8px', backgroundColor: 'var(--badge-primary-bg)',
                          color: 'var(--primary-600)', fontFamily: 'monospace',
                          cursor: 'pointer',
                        }}
                        onClick={() => setDetailModalWOId(item.workOrderId)}
                      >
                        {item.folioNumber}
                      </span>
                      <span
                        style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                        onClick={() => setDetailModalWOId(item.workOrderId)}
                      >
                        {item.patient || '—'}
                      </span>
                    </div>
                    {getStatusBadge(item.processType)}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    {item.doctorName && <>{t('dashboard.labAdmin.doctor')}: <strong>{item.doctorName}</strong></>}
                    {item.prosthesisName && (
                      <span style={{ marginLeft: '12px' }}>
                        {t('dashboard.labAdmin.prosthesis')}: <em>{item.prosthesisName}</em>
                      </span>
                    )}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    marginBottom: '10px',
                  }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('dashboard.labAdmin.verification')}: <strong style={{ color: 'var(--text-main)' }}>{item.processName}</strong>
                      <br />
                      {t('dashboard.labAdmin.evaluator')}: <strong style={{ color: 'var(--text-main)' }}>{item.evaluatorName || '—'}</strong>
                    </div>

                    {item.stepStatus === 'NOT_STARTED' ? (
                      <button
                        onClick={() => handleStartVerification(item.workOrderId, item.processId)}
                        disabled={startingProcessId === item.processId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '6px 14px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'var(--primary-600)', color: '#fff',
                          cursor: startingProcessId === item.processId ? 'wait' : 'pointer',
                          fontSize: '12px', fontWeight: 600,
                          opacity: startingProcessId === item.processId ? 0.6 : 1,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (startingProcessId !== item.processId) e.currentTarget.style.backgroundColor = 'var(--primary-700)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-600)'; }}
                      >
                        <Play size={14} /> {t('dashboard.labAdmin.start')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenVerifyModal(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '6px 14px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'var(--emerald-500)', color: '#fff',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--emerald-600)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--emerald-500)'; }}
                      >
                        <ShieldCheck size={14} /> {t('dashboard.labAdmin.endVerification')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {verifyModal && (
        <VerifyWorkOrderModal
          isOpen={verifyModal.open}
          onClose={() => setVerifyModal(null)}
          workOrderId={verifyModal.workOrderId}
          folioNumber={verifyModal.folioNumber}
          patient={verifyModal.patient}
          processId={verifyModal.processId}
          processName={verifyModal.processName}
          processType={verifyModal.processType}
          onComplete={handleVerifyOutcome}
        />
      )}

      {detailModalWOId && (
        <ViewWorkOrderModal
          workOrderId={detailModalWOId}
          isOpen={Boolean(detailModalWOId)}
          onClose={() => { setDetailModalWOId(null); fetchDashboard(true); }}
          onOrderUpdated={() => fetchDashboard(true)}
        />
      )}
    </div>
  );
};
