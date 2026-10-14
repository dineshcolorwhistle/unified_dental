import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Play,
  Pause,
  Lock,
  Eye,
  RefreshCw,
  ChevronRight,
  Inbox,
  FileText,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { useNotifications } from '../../core/context/NotificationContext';
import {
  workOrderService,
  LabAdminDashboardData,
  LabAdminVerificationAlertItem,
  LabAdminProductionTaskItem,
  LabAdminInProgressItem,
  LabAdminVerificationItem,
  WorkOrderListItem,
} from '../../services/workOrderService';
import { VerifyWorkOrderModal } from '../../components/lab/VerifyWorkOrderModal';
import { ViewWorkOrderModal } from '../../components/lab/ViewWorkOrderModal';
import { EditWorkOrderModal } from '../../components/lab/EditWorkOrderModal';
import { Tooltip } from '../../components/common/Tooltip';

export const LabAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket } = useNotifications();

  const [data, setData] = useState<LabAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState<'production' | 'verification'>('production');
  const [showAllQueueItems, setShowAllQueueItems] = useState(false);
  const [actionLoadingProcessId, setActionLoadingProcessId] = useState<string | null>(null);
  const [inProgressSearch, setInProgressSearch] = useState('');
  const [verificationSearch, setVerificationSearch] = useState('');

  // Modal state
  const [verifyModal, setVerifyModal] = useState<{
    open: boolean;
    workOrderId: string;
    folioNumber: string;
    patient: string;
    processId: string;
    processName: string;
    processType: string;
    doctorName?: string | null;
    doctorType?: string | null;
  } | null>(null);

  const [detailModalWOId, setDetailModalWOId] = useState<string | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<WorkOrderListItem | null>(null);
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

  // Real-time socket listener for instant dashboard KPI & queue sync
  useEffect(() => {
    if (!socket) return;
    const handleRealtimeDashboardSync = () => {
      fetchDashboard(true);
    };

    socket.on('work_order:updated', handleRealtimeDashboardSync);
    socket.on('work_order:created', handleRealtimeDashboardSync);
    socket.on('work_order:process_updated', handleRealtimeDashboardSync);

    return () => {
      socket.off('work_order:updated', handleRealtimeDashboardSync);
      socket.off('work_order:created', handleRealtimeDashboardSync);
      socket.off('work_order:process_updated', handleRealtimeDashboardSync);
    };
  }, [socket, fetchDashboard]);

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

  const handleStartProductionProcess = async (workOrderId: string, processId: string) => {
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.startProcess(workOrderId, processId);
      toast.success(t('dashboard.labAdmin.processStarted', { defaultValue: 'Production process step started' }));
      fetchDashboard(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('dashboard.labAdmin.actionFailed'));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handlePauseProductionProcess = async (workOrderId: string, processId: string) => {
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.pauseProcess(workOrderId, processId);
      toast.success(t('dashboard.labAdmin.processPaused', { defaultValue: 'Production process step paused' }));
      fetchDashboard(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('dashboard.labAdmin.actionFailed'));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handleResumeProductionProcess = async (workOrderId: string, processId: string) => {
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.resumeProcess(workOrderId, processId);
      toast.success(t('dashboard.labAdmin.processResumed', { defaultValue: 'Production process step resumed' }));
      fetchDashboard(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('dashboard.labAdmin.actionFailed'));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handleCompleteProductionProcess = async (workOrderId: string, processId: string) => {
    setActionLoadingProcessId(processId);
    try {
      await workOrderService.completeProcess(workOrderId, processId);
      toast.success(t('dashboard.labAdmin.processCompleted', { defaultValue: 'Production process step completed' }));
      fetchDashboard(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('dashboard.labAdmin.actionFailed'));
    } finally {
      setActionLoadingProcessId(null);
    }
  };

  const handleOpenVerifyModal = (item: {
    workOrderId: string;
    folioNumber: string;
    patient?: string | null;
    processId: string;
    processName: string;
    processType: string;
    doctorName?: string | null;
    doctorType?: string | null;
  }) => {
    setVerifyModal({
      open: true,
      workOrderId: item.workOrderId,
      folioNumber: item.folioNumber,
      patient: item.patient || '',
      processId: item.processId,
      processName: item.processName,
      processType: item.processType,
      doctorName: item.doctorName || null,
      doctorType: item.doctorType || 'LOCAL',
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
  const myProductionTasks = data?.myProductionTasks || [];
  const inProgress = data?.inProgressOrders || [];
  const verifications = data?.verificationOrders || [];
  const isDefaultAdmin = data?.isDefaultAdmin ?? true;

  const currentQueueList = activeQueueTab === 'production' ? myProductionTasks : alerts;
  const displayedQueueItems = showAllQueueItems ? currentQueueList : currentQueueList.slice(0, 3);

  const inProgressQuery = inProgressSearch.trim().toLowerCase();
  const filteredInProgress = inProgress.filter((item: LabAdminInProgressItem) => {
    if (!inProgressQuery) return true;
    return Boolean(
      (item.folioNumber && item.folioNumber.toLowerCase().includes(inProgressQuery)) ||
      (item.patient && item.patient.toLowerCase().includes(inProgressQuery)) ||
      (item.doctorName && item.doctorName.toLowerCase().includes(inProgressQuery)) ||
      (item.prosthesisName && item.prosthesisName.toLowerCase().includes(inProgressQuery)) ||
      (item.currentStepName && item.currentStepName.toLowerCase().includes(inProgressQuery)) ||
      (item.technicianName && item.technicianName.toLowerCase().includes(inProgressQuery))
    );
  });

  const verificationQuery = verificationSearch.trim().toLowerCase();
  const filteredVerifications = verifications.filter((item: LabAdminVerificationItem) => {
    if (!verificationQuery) return true;
    return Boolean(
      (item.folioNumber && item.folioNumber.toLowerCase().includes(verificationQuery)) ||
      (item.patient && item.patient.toLowerCase().includes(verificationQuery)) ||
      (item.doctorName && item.doctorName.toLowerCase().includes(verificationQuery)) ||
      (item.prosthesisName && item.prosthesisName.toLowerCase().includes(verificationQuery)) ||
      (item.processName && item.processName.toLowerCase().includes(verificationQuery)) ||
      (item.evaluatorName && item.evaluatorName.toLowerCase().includes(verificationQuery))
    );
  });

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
      {/* ─── 4 KPI Cards (Rendered First as in Screenshot) ─── */}
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

      {/* ─── Unified Tabbed Action Card: My Production Tasks & Verification Alerts ─── */}
      <div style={{
        marginBottom: '28px',
        borderRadius: '16px',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        backgroundColor: 'rgba(240, 247, 255, 0.75)',
        padding: '16px 20px',
        boxShadow: '0 2px 12px rgba(2, 132, 199, 0.05)',
      }}>
        {/* Tab Switcher Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          {/* Pill Tabs */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '4px',
            borderRadius: '999px',
            border: '1px solid rgba(2, 132, 199, 0.15)',
          }}>
            {/* Tab 1: My Production Tasks */}
            <button
              type="button"
              onClick={() => { setActiveQueueTab('production'); setShowAllQueueItems(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: activeQueueTab === 'production' ? '#ffffff' : 'transparent',
                color: activeQueueTab === 'production' ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeQueueTab === 'production' ? 700 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeQueueTab === 'production' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Play size={13} fill={activeQueueTab === 'production' ? '#0284c7' : 'none'} />
              <span>{t('dashboard.labAdmin.myProductionTasks', { defaultValue: 'My Production Tasks' })}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: '999px',
                backgroundColor: activeQueueTab === 'production' ? '#0284c7' : 'var(--border-color)',
                color: activeQueueTab === 'production' ? '#ffffff' : 'var(--text-muted)',
              }}>
                {myProductionTasks.length}
              </span>
            </button>

            {/* Tab 2: Verification Alerts */}
            <button
              type="button"
              onClick={() => { setActiveQueueTab('verification'); setShowAllQueueItems(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: activeQueueTab === 'verification' ? '#ffffff' : 'transparent',
                color: activeQueueTab === 'verification' ? '#7c3aed' : 'var(--text-muted)',
                fontWeight: activeQueueTab === 'verification' ? 700 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeQueueTab === 'verification' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={14} />
              <span>{t('dashboard.labAdmin.verificationAlerts', { defaultValue: 'Verification Alerts' })}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: '999px',
                backgroundColor: activeQueueTab === 'verification' ? '#7c3aed' : 'var(--border-color)',
                color: activeQueueTab === 'verification' ? '#ffffff' : 'var(--text-muted)',
              }}>
                {alerts.length}
              </span>
            </button>
          </div>

          {/* Right Controls: Show All toggle */}
          {currentQueueList.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllQueueItems((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 14px',
                borderRadius: '20px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              {showAllQueueItems
                ? t('dashboard.labAdmin.showLess', { defaultValue: 'Show Less' })
                : `${t('dashboard.labAdmin.showAll', { defaultValue: 'Show All' })} (${currentQueueList.length})`}
            </button>
          )}
        </div>

        {/* Tab Content List (Top 3 records by default) */}
        {currentQueueList.length === 0 ? (
          <div style={{
            padding: '28px 16px',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: '10px',
            border: '1px dashed rgba(2, 132, 199, 0.25)',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}>
            {activeQueueTab === 'production'
              ? t('dashboard.labAdmin.noProductionTasks', { defaultValue: 'No active production tasks assigned to you.' })
              : t('dashboard.labAdmin.noVerificationAlerts', { defaultValue: 'No pending verification alerts.' })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayedQueueItems.map((item: any) => {
              const itemStatus = item.status || item.stepStatus || 'NOT_STARTED';
              const isInProgress = itemStatus === 'IN_PROGRESS';
              const isPaused = itemStatus === 'PAUSED';
              const isReady = activeQueueTab === 'production' ? Boolean(item.isReadyToStart) : true;
              const isExtVerif = item.processType === 'EXTERNAL_VERIFICATION';

              return (
                <div
                  key={`${item.workOrderId}-${item.processId}`}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid rgba(2, 132, 199, 0.18)',
                    padding: '12px 18px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-400)';
                    e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(2, 132, 199, 0.18)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.03)';
                  }}
                >
                  {/* Top Line: Badges + Patient + Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '8px',
                  }}>
                    {/* Left Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#2563eb',
                        fontFamily: 'monospace',
                        letterSpacing: '0.02em',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                      }}>
                        {item.folioNumber}
                      </span>

                      {item.boxNumber && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          border: '1px solid rgba(2, 132, 199, 0.25)',
                        }}>
                          {t('dashboard.labAdmin.boxNumber', { box: item.boxNumber, defaultValue: `Box Number #${item.boxNumber}` })}
                        </span>
                      )}

                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                      }}>
                        {item.patient || '—'}
                      </span>

                      {/* Status Badge */}
                      {isInProgress ? (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--badge-success-bg)',
                          color: 'var(--emerald-600)',
                          border: '1px solid var(--emerald-200)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                          {t('dashboard.labAdmin.statusInProgress')}
                        </span>
                      ) : isPaused ? (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--badge-warning-bg)',
                          color: 'var(--amber-600)',
                          border: '1px solid var(--amber-200)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                          {t('technician.status.paused', { defaultValue: 'Paused' })}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#94a3b8', display: 'inline-block' }} />
                          {t('dashboard.labAdmin.statusNotStarted')}
                        </span>
                      )}
                    </div>

                    {/* Right Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setDetailModalWOId(item.workOrderId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 14px',
                          borderRadius: '7px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#ffffff',
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
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        <Eye size={14} />
                        <span>{t('dashboard.labAdmin.viewWO')}</span>
                      </button>

                      {/* Dynamic Action Button based on Active Tab */}
                      {activeQueueTab === 'production' ? (
                        isInProgress ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePauseProductionProcess(item.workOrderId, item.processId)}
                              disabled={actionLoadingProcessId === item.processId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '7px',
                                border: '1px solid #fde68a',
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              <Pause size={13} />
                              <span>{t('dashboard.labAdmin.pauseProcess', { defaultValue: 'Pause' })}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteProductionProcess(item.workOrderId, item.processId)}
                              disabled={actionLoadingProcessId === item.processId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 16px',
                                borderRadius: '7px',
                                border: 'none',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <CheckCircle2 size={14} />
                              <span>{t('dashboard.labAdmin.completeProcess', { defaultValue: 'Complete' })}</span>
                            </button>
                          </>
                        ) : isPaused ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResumeProductionProcess(item.workOrderId, item.processId)}
                              disabled={actionLoadingProcessId === item.processId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '7px',
                                border: 'none',
                                backgroundColor: '#38bdf8',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              <Play size={13} fill="currentColor" />
                              <span>{t('dashboard.labAdmin.resumeProcess', { defaultValue: 'Resume' })}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteProductionProcess(item.workOrderId, item.processId)}
                              disabled={actionLoadingProcessId === item.processId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 16px',
                                borderRadius: '7px',
                                border: 'none',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <CheckCircle2 size={14} />
                              <span>{t('dashboard.labAdmin.completeProcess', { defaultValue: 'Complete' })}</span>
                            </button>
                          </>
                        ) : isReady ? (
                          <button
                            type="button"
                            onClick={() => handleStartProductionProcess(item.workOrderId, item.processId)}
                            disabled={actionLoadingProcessId === item.processId}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 18px',
                              borderRadius: '7px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                              color: '#ffffff',
                              cursor: actionLoadingProcessId === item.processId ? 'wait' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 700,
                              boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Play size={13} fill="currentColor" />
                            <span>{t('dashboard.labAdmin.startProcess', { defaultValue: 'Start Process' })}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                              color: 'var(--text-muted)',
                              cursor: 'not-allowed',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            <Lock size={13} />
                            <span>{t('dashboard.labAdmin.waitingPriorStep', { defaultValue: 'Waiting Prior Step' })}</span>
                          </button>
                        )
                      ) : (
                        /* Verification Tab Actions */
                        isInProgress ? (
                          isDefaultAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleOpenVerifyModal(item)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 16px',
                                borderRadius: '7px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                color: '#ffffff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ShieldCheck size={14} />
                              <span>{t('dashboard.labAdmin.endVerification')}</span>
                            </button>
                          ) : (
                            <Tooltip content={t('dashboard.labAdmin.onlyDefaultAdminCanEnd')}>
                              <span>
                                <button
                                  type="button"
                                  disabled
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 16px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-surface-muted)',
                                    color: 'var(--text-muted)',
                                    cursor: 'not-allowed',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    opacity: 0.6,
                                  }}
                                >
                                  <ShieldCheck size={14} />
                                  <span>{t('dashboard.labAdmin.endVerification')}</span>
                                </button>
                              </span>
                            </Tooltip>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartVerification(item.workOrderId, item.processId)}
                            disabled={startingProcessId === item.processId}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 16px',
                              borderRadius: '7px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                              color: '#ffffff',
                              cursor: startingProcessId === item.processId ? 'wait' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 700,
                              boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Play size={13} fill="currentColor" />
                            <span>{t('dashboard.labAdmin.startVerification')}</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Subtitle / Details Line (Matching Screenshot) */}
                  <div style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}>
                    <span>
                      {t('dashboard.labAdmin.process')}: <strong style={{ color: 'var(--text-heading)' }}>{item.processName} (#{item.sequence || item.currentStepSequence || 1})</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {t('dashboard.labAdmin.doctor')}: <strong style={{ color: 'var(--text-heading)' }}>{item.doctorName || '—'}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '10px',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-muted)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('dashboard.labAdmin.inProgressWorkOrders')}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '10px', backgroundColor: 'var(--badge-info-bg)',
                color: 'var(--sky-600)', minWidth: '20px', textAlign: 'center',
              }}>
                {inProgressSearch.trim() ? `${filteredInProgress.length} / ${inProgress.length}` : inProgress.length}
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '200px', maxWidth: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={inProgressSearch}
                onChange={(e) => setInProgressSearch(e.target.value)}
                placeholder={t('dashboard.labAdmin.searchOrders', 'Search orders...')}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 28px 0 30px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-500)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {inProgressSearch && (
                <button
                  type="button"
                  onClick={() => setInProgressSearch('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
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
            ) : filteredInProgress.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px',
                color: 'var(--text-muted)',
              }}>
                <Search size={36} style={{ marginBottom: '10px', opacity: 0.35, color: 'var(--text-muted)' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {t('dashboard.labAdmin.noMatchingOrders', 'No matching orders found')}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                  {t('dashboard.labAdmin.noMatchingDesc', 'No orders match your search criteria.')}
                </div>
                <button
                  type="button"
                  onClick={() => setInProgressSearch('')}
                  style={{
                    marginTop: '12px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--primary-600)',
                    cursor: 'pointer',
                  }}
                >
                  {t('dashboard.labAdmin.clearSearch', 'Clear search')}
                </button>
              </div>
            ) : (
              filteredInProgress.map((item: LabAdminInProgressItem) => (
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailModalWOId(item.workOrderId);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '11.5px',
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
                      <Eye size={13} />
                      <span>{t('dashboard.labAdmin.viewWO')}</span>
                    </button>
                  </div>

                  {item.doctorName && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {t('dashboard.labAdmin.doctor')}: <strong style={{ color: 'var(--text-heading)' }}>{item.doctorName}</strong>
                    </div>
                  )}

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
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '10px',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-muted)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--emerald-500)', flexShrink: 0 }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('dashboard.labAdmin.workOrdersInVerification')}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '10px', backgroundColor: 'var(--badge-success-bg)',
                color: 'var(--emerald-600)', minWidth: '20px', textAlign: 'center',
              }}>
                {verificationSearch.trim() ? `${filteredVerifications.length} / ${verifications.length}` : verifications.length}
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '200px', maxWidth: '100%' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={verificationSearch}
                onChange={(e) => setVerificationSearch(e.target.value)}
                placeholder={t('dashboard.labAdmin.searchOrders', 'Search orders...')}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 28px 0 30px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--emerald-500)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {verificationSearch && (
                <button
                  type="button"
                  onClick={() => setVerificationSearch('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
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
            ) : filteredVerifications.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 16px',
                color: 'var(--text-muted)',
              }}>
                <Search size={36} style={{ marginBottom: '10px', opacity: 0.35, color: 'var(--text-muted)' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {t('dashboard.labAdmin.noMatchingOrders', 'No matching orders found')}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                  {t('dashboard.labAdmin.noMatchingDesc', 'No orders match your search criteria.')}
                </div>
                <button
                  type="button"
                  onClick={() => setVerificationSearch('')}
                  style={{
                    marginTop: '12px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--emerald-600)',
                    cursor: 'pointer',
                  }}
                >
                  {t('dashboard.labAdmin.clearSearch', 'Clear search')}
                </button>
              </div>
            ) : (
              filteredVerifications.map((item: LabAdminVerificationItem) => (
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

                  {item.doctorName && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {t('dashboard.labAdmin.doctor')}: <strong style={{ color: 'var(--text-heading)' }}>{item.doctorName}</strong>
                        {item.doctorType && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: item.doctorType === 'LOCAL' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                            color: item.doctorType === 'LOCAL' ? '#2563eb' : '#7c3aed',
                            border: `1px solid ${item.doctorType === 'LOCAL' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(168, 85, 247, 0.25)'}`,
                          }}>
                            {item.doctorType === 'LOCAL' ? t('dashboard.labAdmin.localDoctor') : t('dashboard.labAdmin.integratedDoctor')}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t('dashboard.labAdmin.evaluator')}: <strong style={{ color: 'var(--text-main)' }}>{item.evaluatorName || '—'}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setDetailModalWOId(item.workOrderId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '8px',
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
                        <Eye size={13} />
                        <span>{t('dashboard.labAdmin.viewWO')}</span>
                      </button>

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
                      ) : isDefaultAdmin ? (
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
                      ) : (
                        <Tooltip content={t('dashboard.labAdmin.onlyDefaultAdminCanEnd')}>
                          <span>
                            <button
                              disabled
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '6px 14px', borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-surface-muted)', color: 'var(--text-muted)',
                                cursor: 'not-allowed', fontSize: '12px', fontWeight: 600,
                                opacity: 0.6,
                              }}
                            >
                              <ShieldCheck size={14} /> {t('dashboard.labAdmin.endVerification')}
                            </button>
                          </span>
                        </Tooltip>
                      )}
                    </div>
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
          doctorName={verifyModal.doctorName}
          doctorType={verifyModal.doctorType}
          onComplete={handleVerifyOutcome}
        />
      )}

      {detailModalWOId && (
        <ViewWorkOrderModal
          workOrderId={detailModalWOId}
          isOpen={Boolean(detailModalWOId)}
          onClose={() => { setDetailModalWOId(null); fetchDashboard(true); }}
          onOrderUpdated={() => fetchDashboard(true)}
          onNavigateToEdit={(order) => {
            setDetailModalWOId(null);
            setOrderToEdit(order);
          }}
        />
      )}

      {orderToEdit && (
        <EditWorkOrderModal
          workOrder={orderToEdit}
          isOpen={Boolean(orderToEdit)}
          onClose={() => setOrderToEdit(null)}
          onSuccess={() => fetchDashboard(true)}
        />
      )}
    </div>
  );
};
