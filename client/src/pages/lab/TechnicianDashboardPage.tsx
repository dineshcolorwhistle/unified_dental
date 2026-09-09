import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Activity,
  Pause,
  CheckCircle2,
  Play,
  Eye,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import {
  workOrderService,
  TechnicianDashboardData,
} from '../../services/workOrderService';
import { TechnicianWorkOrderDetailModal } from '../../components/lab/TechnicianWorkOrderDetailModal';

export const TechnicianDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<TechnicianDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [startingProcessId, setStartingProcessId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await workOrderService.getTechnicianDashboard();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load technician dashboard:', err);
      toast.error(err?.response?.data?.message || t('technician.errors.dashboardFailed', { defaultValue: 'Failed to load dashboard' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleStartProcessFromQueue = async (workOrderId: string, processId: string) => {
    setStartingProcessId(processId);
    try {
      await workOrderService.startProcess(workOrderId, processId);
      toast.success(t('technician.alerts.processStarted', { defaultValue: 'Process started successfully' }));
      fetchDashboard();
      setSelectedWorkOrderId(workOrderId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technician.errors.actionFailed', { defaultValue: 'Failed to start process' }));
    } finally {
      setStartingProcessId(null);
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Technician';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Greeting (Screenshot 1) */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: 'var(--text-heading)',
            margin: '0 0 6px',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.02em',
          }}
        >
          {t('technician.dashboard.greeting', { defaultValue: 'Good morning, {{name}}!', name: firstName })}
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
          {t('technician.dashboard.subtitle', { defaultValue: 'Personal performance tracker and active workbench' })}
        </p>
      </div>

      {/* 4 KPI Metric Cards (Screenshot 1) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {/* Card 1: Pending Steps */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', lineHeight: '1.1' }}>
              {dashboardData?.stats.pendingSteps ?? 0}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('technician.stats.pendingSteps', { defaultValue: 'Pending Steps' })}
            </div>
          </div>
        </div>

        {/* Card 2: Active Steps */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', lineHeight: '1.1' }}>
              {dashboardData?.stats.activeSteps ?? 0}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('technician.stats.activeSteps', { defaultValue: 'Active Steps' })}
            </div>
          </div>
        </div>

        {/* Card 3: Paused Steps */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#fffbeb',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Pause size={22} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', lineHeight: '1.1' }}>
              {dashboardData?.stats.pausedSteps ?? 0}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('technician.stats.pausedSteps', { defaultValue: 'Paused Steps' })}
            </div>
          </div>
        </div>

        {/* Card 4: Completed Today */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #06b6d4',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#ecfeff',
              color: '#0891b2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-heading)', lineHeight: '1.1' }}>
              {dashboardData?.stats.completedToday ?? 0}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('technician.stats.completedToday', { defaultValue: 'Completed Today' })}
            </div>
          </div>
        </div>
      </div>

      {/* My Work Queue Section (Screenshot 1) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Queue Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: '#10b981' }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
              {t('technician.queue.title', { defaultValue: 'My Work Queue' })}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigate('/lab/work-orders/my')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>{t('technician.queue.viewAll', { defaultValue: 'View All Queue' })}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Queue List */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            {t('common.loading', { defaultValue: 'Loading your work queue...' })}
          </div>
        ) : !dashboardData?.queue || dashboardData.queue.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
            }}
          >
            <Sparkles size={32} style={{ color: 'var(--primary-400)', margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
              {t('technician.queue.emptyTitle', { defaultValue: 'All caught up!' })}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('technician.queue.emptyDesc', { defaultValue: 'No active work order steps waiting in your queue right now.' })}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dashboardData.queue.map((item) => {
              const isReady = item.isReadyToStart;
              const isInProgress = item.currentStepStatus === 'IN_PROGRESS';
              const isPaused = item.currentStepStatus === 'PAUSED';

              const statusBadgeLabel = isInProgress
                ? t('technician.status.inProgress', { defaultValue: 'In Progress' })
                : isPaused
                ? t('technician.status.paused', { defaultValue: 'Paused' })
                : isReady
                ? t('technician.status.readyToStart', { defaultValue: 'Ready to Start' })
                : t('technician.status.waitingPrevious', { defaultValue: 'Waiting Previous Step' });

              const statusBadgeColor = isInProgress
                ? '#3b82f6'
                : isPaused
                ? '#f59e0b'
                : isReady
                ? '#10b981'
                : '#94a3b8';

              return (
                <div
                  key={item.workOrderId}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.05)',
                  }}
                >
                  {/* Top Line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        WO#: {item.folioNumber}
                      </span>
                      {item.patient && (
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {item.patient}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: statusBadgeColor,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: statusBadgeColor }}>
                        {statusBadgeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Subtitle Line */}
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>{item.prosthesisTypeName}</span>
                    {item.boxNumber && <span> • Box No.: {item.boxNumber}</span>}
                  </div>

                  {/* Current Step Inner Box */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                      {t('technician.queue.currentStep', { defaultValue: 'CURRENT STEP' })}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
                      Step {item.currentStepSequence}: {item.currentStepName}
                    </div>
                  </div>

                  {/* Bottom Right Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedWorkOrderId(item.workOrderId)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Eye size={15} />
                      <span>{t('technician.queue.viewDetails', { defaultValue: 'View Details' })}</span>
                    </button>

                    {isReady && item.currentStepStatus === 'NOT_STARTED' ? (
                      <button
                        type="button"
                        onClick={() => handleStartProcessFromQueue(item.workOrderId, item.currentProcessId)}
                        disabled={startingProcessId === item.currentProcessId}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#38bdf8',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: startingProcessId === item.currentProcessId ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(56, 189, 248, 0.25)',
                        }}
                      >
                        <Play size={14} />
                        <span>{t('technician.queue.startProcess', { defaultValue: 'Start Process' })}</span>
                      </button>
                    ) : isInProgress ? (
                      <button
                        type="button"
                        onClick={() => setSelectedWorkOrderId(item.workOrderId)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Activity size={14} />
                        <span>{t('technician.queue.inProgressBtn', { defaultValue: 'In Progress' })}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedWorkOrderId && (
        <TechnicianWorkOrderDetailModal
          workOrderId={selectedWorkOrderId}
          onClose={() => setSelectedWorkOrderId(null)}
          onRefresh={fetchDashboard}
        />
      )}
    </div>
  );
};
