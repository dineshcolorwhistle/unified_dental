import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';
import { Pagination } from '../common/Pagination';
import { formatDate, getTodayDateString } from '../../core/utils/dateUtils';
import {
  clinicAdvancePaymentService,
  PatientAdvancePaymentItem,
  TreatmentPlanDoctorItem,
} from '../../services/clinicAdvancePaymentService';
import { paymentMethodService, PaymentMethodItem } from '../../services/paymentMethodService';
import { PatientOptionItem } from './AddPatientNoteModal';
import {
  X,
  Wallet,
  Calendar,
  CreditCard,
  User,
  Stethoscope,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  CheckCircle2,
  Receipt,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface PatientAdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPatientId?: string | null;
  patientsList?: PatientOptionItem[];
}

const DEFAULT_PATIENTS_LIST: PatientOptionItem[] = [];

export const PatientAdvancePaymentModal: React.FC<PatientAdvancePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  patientsList = DEFAULT_PATIENTS_LIST,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [allPatients, setAllPatients] = useState<PatientOptionItem[]>(patientsList);

  // Form states
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [amount, setAmount] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Dynamic Payment Methods (Branch-wise, Income + Both)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [loadingMethods, setLoadingMethods] = useState<boolean>(false);
  const [patientBranchId, setPatientBranchId] = useState<string | null>(null);

  // Doctor & Treatment Plan Context
  const [loadingContext, setLoadingContext] = useState<boolean>(false);
  const [hasTreatmentPlan, setHasTreatmentPlan] = useState<boolean>(false);
  const [planDoctors, setPlanDoctors] = useState<TreatmentPlanDoctorItem[]>([]);

  // Existing Advance Payments History states
  const [payments, setPayments] = useState<PatientAdvancePaymentItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(5);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalAdvancesAmount, setTotalAdvancesAmount] = useState<number>(0);
  const [totalAvailableBalance, setTotalAvailableBalance] = useState<number>(0);

  // Responsive Viewport Tracking (< 768px)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'history'>('form');

  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch dynamic payment methods configured for clinic branch (Income and Both only)
  const fetchPaymentMethods = useCallback(
    async (targetBranchId?: string | null) => {
      setLoadingMethods(true);
      try {
        const branch = targetBranchId || user?.activeBranchId || undefined;
        const res = await paymentMethodService.getAll({
          moduleKey: 'CLINIC',
          branchId: branch,
          activeOnly: true,
          type: 'INCOME',
        });
        // Filter strictly to active methods of type INCOME or BOTH
        const validMethods = (res || []).filter(
          (m) => m.isActive && (m.type === 'INCOME' || m.type === 'BOTH')
        );
        setPaymentMethods(validMethods);
        if (validMethods.length > 0) {
          setPaymentMethod((prev) => {
            return validMethods.some((m) => m.name === prev) ? prev : validMethods[0].name;
          });
        }
      } catch (err) {
        console.warn('Failed to load clinic payment methods:', err);
        setPaymentMethods([]);
      } finally {
        setLoadingMethods(false);
      }
    },
    [user?.activeBranchId]
  );

  // Sync initial patient & load payment methods on open
  useEffect(() => {
    if (isOpen) {
      if (initialPatientId) {
        setPatientId(initialPatientId);
      }
      setAmount('');
      setSelectedDoctorId('');
      setPaymentDate(getTodayDateString());
      setNotes('');
      setValidationErrors({});
      setSearchKeyword('');
      setPage(1);
      setActiveMobileTab('form');

      const initialBranch = (selectedPatient as any)?.branchId || user?.activeBranchId || null;
      fetchPaymentMethods(initialBranch);
    }
  }, [isOpen, initialPatientId, fetchPaymentMethods]);

  // Sync patientsList if provided
  useEffect(() => {
    if (patientsList && patientsList.length > 0) {
      setAllPatients(patientsList);
    }
  }, [patientsList]);

  // Selected Patient Details
  const selectedPatient = useMemo(() => {
    if (!patientId) return null;
    return allPatients.find((p) => p.id === patientId) || null;
  }, [allPatients, patientId]);

  // Build options for patient select
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

  // Fetch Treatment Plan & Doctor Context for Selected Patient
  const fetchContext = useCallback(async (pId: string) => {
    if (!pId) {
      setHasTreatmentPlan(false);
      setPlanDoctors([]);
      return;
    }
    setLoadingContext(true);
    try {
      const res = await clinicAdvancePaymentService.getAdvancePaymentContext(pId);
      setHasTreatmentPlan(res.hasTreatmentPlan);
      setPlanDoctors(res.doctors || []);
      const resolvedBranch = res.branchId || null;
      setPatientBranchId(resolvedBranch);
      fetchPaymentMethods(resolvedBranch);

      // Pre-select first doctor if treatment plan exists and doctors are assigned
      if (res.hasTreatmentPlan && res.doctors?.length > 0) {
        setSelectedDoctorId(res.doctors[0].id);
      } else {
        setSelectedDoctorId('');
      }
    } catch (err) {
      console.warn('Failed to load advance payment context:', err);
      setHasTreatmentPlan(false);
      setPlanDoctors([]);
      setSelectedDoctorId('');
    } finally {
      setLoadingContext(false);
    }
  }, [fetchPaymentMethods]);

  // Fetch Existing Advance Payments
  const fetchPayments = useCallback(
    async (pId: string, pageNum: number, pageSize: number, search: string) => {
      if (!pId) {
        setPayments([]);
        setTotal(0);
        setTotalPages(1);
        setTotalAdvancesAmount(0);
        setTotalAvailableBalance(0);
        return;
      }
      setLoadingPayments(true);
      try {
        const res = await clinicAdvancePaymentService.getPatientAdvancePayments(pId, {
          page: pageNum,
          limit: pageSize,
          search,
        });
        setPayments(res.payments || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setTotalAdvancesAmount(res.totalAdvancesAmount || 0);
        setTotalAvailableBalance(res.totalAvailableBalance || 0);
      } catch (err) {
        console.warn('Failed to load patient advance payments:', err);
        setPayments([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoadingPayments(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen && patientId) {
      fetchContext(patientId);
      fetchPayments(patientId, page, limit, searchKeyword);
    }
  }, [isOpen, patientId, page, limit, fetchContext, fetchPayments]);

  const handleSearchChange = (val: string) => {
    setSearchKeyword(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      if (patientId) {
        fetchPayments(patientId, 1, limit, val);
      }
    }, 300);
  };

  const handleRefreshPayments = () => {
    if (patientId) {
      fetchPayments(patientId, page, limit, searchKeyword);
      fetchContext(patientId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!patientId) {
      errors.patientId = t('clinicPatients.advancePaymentModal.patientRequired', 'Patient is required');
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      errors.amount = t(
        'clinicPatients.advancePaymentModal.amountRequired',
        'Amount must be greater than 0'
      );
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await clinicAdvancePaymentService.createAdvancePayment(patientId, {
        patientId,
        doctorId: selectedDoctorId ? selectedDoctorId : null,
        amount: numAmount,
        paymentMethod,
        paymentDate,
        notes: notes.trim() || undefined,
      });

      success(
        t(
          'clinicPatients.advancePaymentModal.createSuccess',
          'Advance payment recorded successfully.'
        )
      );

      // Reset form and reload payment history
      setAmount('');
      setNotes('');
      setValidationErrors({});
      fetchPayments(patientId, 1, limit, searchKeyword);
      if (isMobileScreen) {
        setActiveMobileTab('history');
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        t('clinicPatients.advancePaymentModal.createFailed', 'Failed to record advance payment.');
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
        padding: isMobileScreen ? '8px' : '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-2xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25))',
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Modal Header ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
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
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--emerald-600, #059669)',
                flexShrink: 0,
              }}
            >
              <Wallet size={20} />
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
                  {t('clinicPatients.advancePaymentModal.title', 'Advance Payment')}
                </h2>
                {selectedPatient && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--emerald-700, #047857)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>#{selectedPatient.recordNumber}</span>
                    <span>•</span>
                    <span>
                      {selectedPatient.firstName} {selectedPatient.fatherLastName || ''}
                    </span>
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
                  'clinicPatients.advancePaymentModal.subtitle',
                  'Record and track patient advance deposits against treatment plans or general balance.'
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Mobile Segmented Tab Switcher (< 768px) ─── */}
        {isMobileScreen && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
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
                    ? 'var(--emerald-600, #059669)'
                    : 'var(--text-muted, #64748b)',
                boxShadow:
                  activeMobileTab === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <CreditCard size={15} />
              <span>{t('clinicPatients.advancePaymentModal.tabForm', 'New Payment')}</span>
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
                    ? 'var(--emerald-600, #059669)'
                    : 'var(--text-muted, #64748b)',
                boxShadow:
                  activeMobileTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Receipt size={15} />
              <span>
                {t('clinicPatients.advancePaymentModal.tabHistory', 'Payment History')}{' '}
                {total > 0 && `(${total})`}
              </span>
            </button>
          </div>
        )}

        {/* ─── Modal Body (Dual Column Layout) ─── */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            flexDirection: isMobileScreen ? 'column' : 'row',
          }}
        >
          {/* ─── Left Column: Creation Form ─── */}
          {(!isMobileScreen || activeMobileTab === 'form') && (
            <div
              style={{
                flex: isMobileScreen ? '1 1 auto' : '0 0 460px',
                borderRight: isMobileScreen ? 'none' : '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-card, #ffffff)',
                minHeight: 0,
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                  flex: 1,
                }}
              >
                {/* 1. Patient Selection (Locked if opened with initial patient) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--text-heading, #0f172a)',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{t('clinicPatients.advancePaymentModal.patient', 'Patient')}</span>
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {initialPatientId ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-main, #334155)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <User size={15} style={{ color: 'var(--emerald-600, #059669)' }} />
                      <span>
                        {selectedPatient
                          ? `${selectedPatient.firstName} ${selectedPatient.fatherLastName || ''}`.trim()
                          : `#${initialPatientId}`}
                      </span>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={patientSelectOptions}
                      value={patientId}
                      onChange={(val) => {
                        setPatientId(val);
                        setValidationErrors((prev) => ({ ...prev, patientId: '' }));
                      }}
                      placeholder={t('clinicPatients.addNoteModal.patientPlaceholder', 'Select patient...')}
                    />
                  )}
                  {validationErrors.patientId && (
                    <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
                      {validationErrors.patientId}
                    </span>
                  )}
                </div>

                {/* 2. Amount Input & Payment Date in 2 columns */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: 'var(--text-heading, #0f172a)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{t('clinicPatients.advancePaymentModal.amount', 'Advance Amount')}</span>
                      <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--text-muted, #64748b)',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setValidationErrors((prev) => ({ ...prev, amount: '' }));
                        }}
                        placeholder="0.00"
                        className="form-control"
                        style={{
                          paddingLeft: '26px',
                          height: '38px',
                          borderRadius: '8px',
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: 'var(--emerald-700, #047857)',
                          borderColor: validationErrors.amount ? '#ef4444' : undefined,
                        }}
                      />
                    </div>
                    {validationErrors.amount && (
                      <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '2px' }}>
                        {validationErrors.amount}
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: 'var(--text-heading, #0f172a)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{t('clinicPatients.advancePaymentModal.paymentDate', 'Payment Date')}</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="form-control"
                      style={{
                        height: '38px',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>

                {/* 3. Doctor Attribution (Dynamic based on Treatment Plan presence) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--text-heading, #0f172a)',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Stethoscope size={14} style={{ color: 'var(--primary-600, #0d9488)' }} />
                    <span>{t('clinicPatients.advancePaymentModal.doctor', 'Attending Doctor')}</span>
                  </label>

                  {loadingContext ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                      Loading doctors...
                    </div>
                  ) : hasTreatmentPlan && planDoctors.length > 0 ? (
                    <>
                      <select
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="form-control"
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        <option value="">
                          {t(
                            'clinicPatients.advancePaymentModal.generalAdvanceOption',
                            'General Advance (No Doctor Assigned)'
                          )}
                        </option>
                        {planDoctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                          </option>
                        ))}
                      </select>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          fontSize: '11.5px',
                          color: '#0f766e',
                          marginTop: '4px',
                          lineHeight: 1.35,
                        }}
                      >
                        <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>
                          {t(
                            'clinicPatients.advancePaymentModal.hasTreatmentPlanHelp',
                            'Patient has an active treatment plan. Associate payment with an assigned doctor.'
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        fontSize: '12px',
                        color: 'var(--text-muted, #64748b)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <span>
                        {t(
                          'clinicPatients.advancePaymentModal.noTreatmentPlanHelp',
                          'No treatment plan found for this patient. This payment will be recorded as a General Advance.'
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Payment Method Selection */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--text-heading, #0f172a)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('clinicPatients.advancePaymentModal.paymentMethod', 'Payment Method')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={loadingMethods}
                    className="form-control"
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {loadingMethods ? (
                      <option value="" disabled>
                        {t('common.loading', 'Loading...')}
                      </option>
                    ) : paymentMethods.length === 0 ? (
                      <option value="Cash">Cash</option>
                    ) : (
                      paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.name}>
                          {pm.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* 5. Notes / Observations */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--text-heading, #0f172a)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('clinicPatients.advancePaymentModal.notes', 'Notes & Observations')}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t(
                      'clinicPatients.advancePaymentModal.notesPlaceholder',
                      'Add reference notes regarding this payment...'
                    )}
                    className="form-control"
                    style={{
                      borderRadius: '8px',
                      fontSize: '13px',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* 6. Real-Time Calculation Preview Card */}
                {parseFloat(amount) > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                        {t('clinicPatients.advancePaymentModal.amount', 'Advance Amount')}:
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#047857' }}>
                        ${parseFloat(amount).toFixed(2)} MXN
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11.5px',
                        color: 'var(--text-muted, #64748b)',
                      }}
                    >
                      <span>{t('clinicPatients.advancePaymentModal.doctorAttribution', 'Doctor')}:</span>
                      <span style={{ fontWeight: 600 }}>
                        {selectedDoctorId
                          ? planDoctors.find((d) => d.id === selectedDoctorId)?.name || 'Doctor'
                          : t('clinicPatients.advancePaymentModal.general', 'General Advance')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Form Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    disabled={isSubmitting}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    style={{
                      height: '38px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: 'var(--emerald-600, #059669)',
                    }}
                  >
                    {isSubmitting ? (
                      <span>{t('clinicPatients.advancePaymentModal.savingBtn', 'Recording...')}</span>
                    ) : (
                      <>
                        <Wallet size={15} />
                        <span>
                          {t('clinicPatients.advancePaymentModal.saveBtn', 'Record Advance Payment')}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── Right Column: Advance Payment History ─── */}
          {(!isMobileScreen || activeMobileTab === 'history') && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                minHeight: 0,
              }}
            >
              {/* Header with Search and KPI stats */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Search Bar + Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted, #94a3b8)',
                      }}
                    />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t(
                        'clinicPatients.advancePaymentModal.searchPlaceholder',
                        'Search by receipt #, doctor, or notes...'
                      )}
                      className="form-control"
                      style={{
                        height: '36px',
                        paddingLeft: '34px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRefreshPayments}
                    style={{
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '8px',
                    }}
                    title={t('clinicPatients.addNoteModal.refreshNotes', 'Refresh')}
                  >
                    <RefreshCw size={14} className={loadingPayments ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* KPI Summary Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color, #e2e8f0)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                      {t('clinicPatients.advancePaymentModal.totalAdvances', 'Total Advances')}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading, #0f172a)', marginTop: '2px' }}>
                      ${totalAdvancesAmount.toFixed(2)} MXN
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857' }}>
                      {t('clinicPatients.advancePaymentModal.availableBalance', 'Available Balance')}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                      ${totalAvailableBalance.toFixed(2)} MXN
                    </div>
                  </div>
                </div>
              </div>

              {/* History List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {loadingPayments ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      color: 'var(--text-muted, #64748b)',
                      gap: '8px',
                    }}
                  >
                    <RefreshCw size={20} className="animate-spin" />
                    <span style={{ fontSize: '13px' }}>Loading advance payments...</span>
                  </div>
                ) : payments.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: 'var(--text-muted, #64748b)',
                      gap: '8px',
                    }}
                  >
                    <Receipt size={32} style={{ color: '#cbd5e1' }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                      {searchKeyword
                        ? t(
                            'clinicPatients.advancePaymentModal.noSearchMatch',
                            'No advance payments match your search keyword.'
                          )
                        : t(
                            'clinicPatients.advancePaymentModal.noPaymentsFound',
                            'No previous advance payments found for this patient.'
                          )}
                    </span>
                  </div>
                ) : (
                  payments.map((p) => {
                    return (
                      <div
                        key={p.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          padding: '12px 14px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {/* Top row: Amount + Date */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-heading, #0f172a)' }}>
                            ${Number(p.amount).toFixed(2)} MXN
                          </span>

                          <div
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-muted, #64748b)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Calendar size={12} />
                            <span>{formatDate(p.paymentDate)}</span>
                          </div>
                        </div>

                        {/* Middle row: Doctor Attribution & Payment Method */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          {p.doctor ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: 'var(--primary-700, #0f766e)',
                                backgroundColor: '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              <Stethoscope size={12} />
                              <span>{p.doctor.name}</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: 'var(--text-muted, #64748b)',
                                backgroundColor: '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              <User size={12} />
                              <span>{t('clinicPatients.advancePaymentModal.general', 'General')}</span>
                            </span>
                          )}

                          {p.paymentMethod && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#475569',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                textTransform: 'capitalize',
                              }}
                            >
                              {p.paymentMethod}
                            </span>
                          )}
                        </div>

                        {/* Notes if present */}
                        {p.notes && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-main, #334155)',
                              backgroundColor: '#f8fafc',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              lineHeight: 1.4,
                            }}
                          >
                            {p.notes}
                          </div>
                        )}

                        {/* Footer: Recorded By info */}
                        {p.createdBy && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted, #94a3b8)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={11} />
                            <span>
                              {t('clinicPatients.advancePaymentModal.recordedBy', 'Recorded by')}{' '}
                              {p.createdBy.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Mandatory Table Pagination Standard (Rule 11) */}
              {total > 0 && (
                <div
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={total}
                    pageSize={limit}
                    pageSizeOptions={[5, 10, 20]}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(sz) => {
                      setLimit(sz);
                      setPage(1);
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
