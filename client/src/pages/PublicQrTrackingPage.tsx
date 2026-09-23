import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { formatDate } from '../core/utils/dateUtils';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Heart,
  Layers,
  Palette,
  PauseCircle,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';

interface TrackingWorkOrder {
  id: string;
  folioNumber: string;
  fileNumber?: string | null;
  boxNumber?: string | null;
  patient?: string | null;
  specification?: string | null;
  color?: string | null;
  notes?: string | null;
  deliveryDate?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  doctor?: {
    id: string;
    name: string;
    clinicName?: string | null;
  } | null;
  prosthesisType?: {
    id: string;
    name: string;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  } | null;
  processes: Array<{
    id: string;
    processName: string;
    processType: string;
    sequence: number;
    isVerification: boolean;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    totalActiveDuration?: number;
  }>;
}

export const PublicQrTrackingPage: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<TrackingWorkOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Contact / Interest Form Modal State
  const [isInterestModalOpen, setIsInterestModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrToken) {
      setError('Invalid or missing QR tracking link');
      setLoading(false);
      return;
    }

    const fetchTrackingData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/public/qr/${qrToken}`);
        const data = res.data?.data || res.data;
        setOrder(data);
      } catch (err: any) {
        console.error('Failed to load tracking data:', err);
        setError(
          err?.response?.data?.message ||
            t('publicQr.errorNotFound', 'Work order not found for this QR code.'),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTrackingData();
  }, [qrToken, t]);

  // Public tracking initially defaults to Spanish per requirement
  useEffect(() => {
    const savedPublicLang = sessionStorage.getItem('public_qr_lang');
    if (savedPublicLang) {
      if (i18n.language !== savedPublicLang) {
        i18n.changeLanguage(savedPublicLang);
      }
    } else {
      i18n.changeLanguage('es');
      sessionStorage.setItem('public_qr_lang', 'es');
    }
  }, [i18n]);

  // Submit Interest Lead Form
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrToken || !formData.name.trim() || !formData.email.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      await api.post('/public/qr/inquiry', {
        qrToken,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        message: formData.message.trim() || undefined,
      });
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error('Failed to submit interest lead:', err);
      setSubmitError(
        err?.response?.data?.message ||
          t('publicQr.submitError', 'Failed to submit inquiry. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const closeInterestModal = () => {
    setIsInterestModalOpen(false);
    setSubmitSuccess(false);
    setSubmitError(null);
    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  // Calculation of completed steps
  const { completedCount, totalSteps, completionPct } = useMemo(() => {
    if (!order?.processes) return { completedCount: 0, totalSteps: 0, completionPct: 0 };
    const total = order.processes.length;
    const completed = order.processes.filter((p) => p.status === 'COMPLETED').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedCount: completed, totalSteps: total, completionPct: pct };
  }, [order?.processes]);

  // Status badge config
  const getWorkOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: t('enums.workOrderStatus.COMPLETED', 'Completed'),
          bg: '#14532d',
          color: '#86efac',
          icon: <CheckCircle2 size={13} />,
        };
      case 'IN_PROGRESS':
        return {
          label: t('enums.workOrderStatus.IN_PROGRESS', 'In Progress'),
          bg: '#1e3a8a',
          color: '#93c5fd',
          icon: <Activity size={13} />,
        };
      case 'ASSIGNED':
        return {
          label: t('enums.workOrderStatus.ASSIGNED', 'Assigned'),
          bg: '#1e293b',
          color: '#38bdf8',
          icon: <Clock size={13} />,
        };
      case 'INTERNAL_VERIFICATION':
      case 'EXTERNAL_VERIFICATION':
        return {
          label: t('enums.workOrderStatus.VERIFICATION', 'Verification'),
          bg: '#713f12',
          color: '#fde047',
          icon: <Clock size={13} />,
        };
      case 'FAILED':
      case 'CANCELLED':
        return {
          label: t(`enums.workOrderStatus.${status}`, status),
          bg: '#7f1d1d',
          color: '#fca5a5',
          icon: <XCircle size={13} />,
        };
      case 'CREATED':
      default:
        return {
          label: t('enums.workOrderStatus.CREATED', 'Created'),
          bg: 'rgba(51, 65, 85, 0.7)',
          color: '#cbd5e1',
          icon: <Clock size={13} />,
        };
    }
  };

  const getProcessStepBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: t('publicQr.statusCompleted', 'Completed'),
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80',
        };
      case 'IN_PROGRESS':
        return {
          label: t('publicQr.statusInProgress', 'In Progress'),
          bg: 'rgba(59, 130, 246, 0.18)',
          color: '#60a5fa',
        };
      case 'PAUSED':
        return {
          label: t('publicQr.statusPaused', 'Paused'),
          bg: 'rgba(234, 179, 8, 0.15)',
          color: '#facc15',
        };
      case 'FAILED':
      case 'CANCELLED':
        return {
          label: t('publicQr.statusCancelled', 'Cancelled'),
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
        };
      case 'NOT_STARTED':
      default:
        return {
          label: t('publicQr.statusNotStarted', 'Not Started'),
          bg: 'rgba(148, 163, 184, 0.12)',
          color: '#94a3b8',
        };
    }
  };

  // Loading State
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a101d',
          color: '#94a3b8',
          gap: '14px',
          fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
          {t('publicQr.loading', 'Loading work order details...')}
        </div>
      </div>
    );
  }

  // Error State
  if (error || !order) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a101d',
          padding: '24px',
          fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AlertCircle size={26} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
            {t('publicQr.errorTitle', 'Tracking Information Unavailable')}
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
            {error || t('publicQr.errorNotFound', 'Work order not found for this QR code.')}
          </p>
        </div>
      </div>
    );
  }

  const statusBadge = getWorkOrderStatusBadge(order.status);
  const tenantName = order.tenant?.name || 'CRIMA';

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#070b14',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(14, 165, 233, 0.12), transparent 70%)',
        color: '#f1f5f9',
        fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        padding: '0 0 60px 0',
      }}
    >
      {/* ─── 1. TOP HEADER BAR ───────────────────────────────── */}
      <header
        className="public-qr-header"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(10, 16, 29, 0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Tenant Brand & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 auto' }}>
            {order.tenant?.logoUrl ? (
              <img
                src={order.tenant.logoUrl}
                alt={tenantName}
                style={{ height: '32px', maxWidth: '110px', objectFit: 'contain', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
                  flexShrink: 0,
                }}
              >
                {tenantName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                className="public-qr-brand-title"
                style={{
                  fontSize: '14.5px',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={tenantName}
              >
                {tenantName}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {t('publicQr.headerSubtitle', 'Work Order Tracking')}
              </div>
            </div>
          </div>

          {/* Right Header Actions: Language Switcher Dropdown & "I'm Interested" Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Language Switcher Dropdown */}
            <LanguageSwitcher variant="dark" compact={true} />

            {/* Top "I'm Interested" Button */}
            <button
              type="button"
              onClick={() => setIsInterestModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'transform 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Heart size={13} fill="#ffffff" />
              <span>{t('publicQr.interestedBtn', "I'm Interested")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ─────────────────────────── */}
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ─── CARD 1: FOLIO & STATUS BADGES ─────────────────── */}
        <section
          style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '24px 28px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#64748b',
                  marginBottom: '4px',
                }}
              >
                {t('publicQr.folioLabel', 'FOLIO')}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: '#ffffff',
                  fontFamily: 'var(--font-heading, "Outfit", "Inter", sans-serif)',
                  letterSpacing: '0.02em',
                }}
              >
                {order.folioNumber}
              </div>
            </div>

            {/* Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                backgroundColor: statusBadge.bg,
                color: statusBadge.color,
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {statusBadge.icon}
              <span>{statusBadge.label}</span>
            </div>
          </div>

          {/* Chips row: Prosthesis Type & Shade */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
            {order.prosthesisType?.name && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(30, 58, 138, 0.4)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                <Sparkles size={13} style={{ color: '#60a5fa' }} />
                <span>{order.prosthesisType.name}</span>
              </div>
            )}

            {order.color && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(51, 65, 85, 0.5)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <Palette size={13} style={{ color: '#f43f5e' }} />
                <span>{order.color}</span>
              </div>
            )}
          </div>
        </section>

        {/* ─── CARD 2: GENERAL INFORMATION ───────────────────── */}
        <section
          style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '24px 28px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <FileText size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              {t('publicQr.generalInfoTitle', 'General Information')}
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Patient */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                {t('publicQr.patient', 'Patient')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                {order.patient || '—'}
              </div>
            </div>

            {/* Doctor */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                {t('publicQr.doctor', 'Doctor')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                {order.doctor?.name || '—'}
              </div>
              {order.doctor?.clinicName && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {order.doctor.clinicName}
                </div>
              )}
            </div>

            {/* Prosthesis Type */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                {t('publicQr.prosthesisType', 'Prosthesis Type')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                {order.prosthesisType?.name || '—'}
              </div>
            </div>

            {/* Creation Date */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                {t('publicQr.createdDate', 'Creation Date')}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                {order.createdAt ? formatDate(order.createdAt) : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* ─── CARD 3: SPECIFICATIONS ─────────────────────────── */}
        {order.specification && (
          <section
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px 28px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Layers size={18} style={{ color: '#38bdf8' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                {t('publicQr.specificationsTitle', 'Specifications')}
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '13.5px',
                color: '#cbd5e1',
                lineHeight: 1.6,
              }}
            >
              {order.specification}
            </div>
          </section>
        )}

        {/* ─── CARD 4: PROCESS FLOW (TIMELINE) ────────────────── */}
        <section
          style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '24px 28px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Heading & Progress Percentage */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={18} style={{ color: '#38bdf8' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  {t('publicQr.processFlowTitle', 'Process Flow')}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {t('publicQr.stepsProgress', {
                    completed: completedCount,
                    total: totalSteps,
                    pct: completionPct,
                    defaultValue: `${completedCount} of ${totalSteps} steps completed (${completionPct}%)`,
                  })}
                </div>
              </div>
            </div>

            {/* Percentage Pill */}
            <div
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {completionPct}%
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${completionPct}%`,
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Step List */}
          {order.processes && order.processes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {order.processes.map((proc, index) => {
                const stepBadge = getProcessStepBadge(proc.status);
                const isCompleted = proc.status === 'COMPLETED';

                return (
                  <div
                    key={proc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: isCompleted
                        ? '1px solid rgba(34, 197, 94, 0.2)'
                        : '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Step Number Circle */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted
                          ? '#15803d'
                          : proc.status === 'IN_PROGRESS'
                          ? '#1d4ed8'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Step Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#64748b',
                          letterSpacing: '0.04em',
                          marginBottom: '2px',
                        }}
                      >
                        {t('publicQr.step', 'Step')} {index + 1}
                      </div>
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {proc.processName}
                      </div>
                    </div>

                    {/* Step Status Badge */}
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        backgroundColor: stepBadge.bg,
                        color: stepBadge.color,
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                        flexShrink: 0,
                      }}
                    >
                      {stepBadge.label}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
              {t('publicQr.noProcesses', 'No process steps recorded for this order yet.')}
            </div>
          )}
        </section>

        {/* ─── BOTTOM CTA: "I'M INTERESTED" ───────────────────── */}
        <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsInterestModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 36px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <Heart size={18} fill="#ffffff" />
            <span>{t('publicQr.interestedBtn', "I'm Interested")}</span>
            <ChevronRight size={18} />
          </button>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {t('publicQr.interestedSubtitle', 'Leave your details and we will get back to you.')}
          </div>
        </div>

        {/* ─── FOOTER ─────────────────────────────────────────── */}
        <footer style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: '#475569' }}>
          {t('publicQr.poweredBy', 'Powered by')} <strong style={{ color: '#94a3b8' }}>{tenantName}</strong>
        </footer>
      </main>

      {/* ─── CONTACT / INTEREST MODAL ───────────────────────── */}
      {isInterestModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInterestModal();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                  {t('publicQr.interestModalTitle', 'Interested in Our Services?')}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  {t('publicQr.interestedSubtitle', 'Leave your details and we will get back to you.')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInterestModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div style={{ padding: '24px' }}>
              {submitSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    {t('publicQr.submitSuccessTitle', 'Thank You!')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                    {t('publicQr.submitSuccessMsg', 'Your request has been received. Our team will contact you shortly.')}
                  </p>
                  <button
                    type="button"
                    onClick={closeInterestModal}
                    style={{
                      marginTop: '24px',
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {submitError && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        fontSize: '12.5px',
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      {t('publicQr.fullName', 'Full Name')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('publicQr.fullNamePlaceholder', 'Enter your full name')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      {t('publicQr.email', 'Email Address')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t('publicQr.emailPlaceholder', 'Enter your email address')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      {t('publicQr.phoneOptional', 'Phone Number (Optional)')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder={t('publicQr.phonePlaceholder', 'Enter your phone number')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Optional Message */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      {t('publicQr.message', 'Message (Optional)')}
                    </label>
                    <textarea
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder={t('publicQr.messagePlaceholder', 'Any additional message or question...')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      marginTop: '8px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    <Send size={15} />
                    <span>{submitting ? t('common.loading', 'Submitting...') : t('publicQr.submitBtn', 'Submit Request')}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
