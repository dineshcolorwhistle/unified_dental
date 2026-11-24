import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import api from '../../services/api';
import {
  incomeService,
  IncomeRecordDetail,
  IncomeServiceLineItem,
  IncomeProductLineItem,
  IncomePaymentItem,
  IncomeVarianceData,
  IncomeAuditItem,
} from '../../services/incomeService';
import { clinicServiceService, ClinicServiceItem } from '../../services/clinicServiceService';
import { paymentMethodService, PaymentMethodItem } from '../../services/paymentMethodService';
import {
  clinicAdvancePaymentService,
  PatientAdvancePaymentItem,
} from '../../services/clinicAdvancePaymentService';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { Pagination } from '../../components/common/Pagination';
import { Tooltip } from '../../components/common/Tooltip';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  History,
  FileText,
  Package,
  CreditCard,
  Check,
  X,
  RefreshCw,
  Wallet,
  ShieldAlert,
  Edit3,
} from 'lucide-react';

export const AppointmentIncomePage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith('es');
  const { success, error: toastError } = useToast();

  // Primary Data State
  const [record, setRecord] = useState<IncomeRecordDetail | null>(null);
  const [variance, setVariance] = useState<IncomeVarianceData | null>(null);
  const [auditLogs, setAuditLogs] = useState<IncomeAuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(10);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'income' | 'audit'>('income');
  const [patientAdvanceBalance, setPatientAdvanceBalance] = useState<number>(0);

  // Modals & Action States
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Edit Modals
  const [editingServiceLine, setEditingServiceLine] = useState<IncomeServiceLineItem | null>(null);
  const [editServiceForm, setEditServiceForm] = useState({
    quantity: 1,
    unitPrice: 0,
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: 0,
  });

  const [editingProductLine, setEditingProductLine] = useState<IncomeProductLineItem | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    quantity: 1,
  });

  // Confirm Completion Modal (Irreversible action)
  const [confirmCompleteServiceLine, setConfirmCompleteServiceLine] = useState<IncomeServiceLineItem | null>(null);

  // Deleting Lines (Validation)
  const [deletingServiceLine, setDeletingServiceLine] = useState<IncomeServiceLineItem | null>(null);
  const [deletingProductLine, setDeletingProductLine] = useState<IncomeProductLineItem | null>(null);

  // Submitting States
  const [submittingService, setSubmittingService] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [endingAppointment, setEndingAppointment] = useState(false);
  const [togglingLineId, setTogglingLineId] = useState<string | null>(null);

  // Catalogs
  const [availableServices, setAvailableServices] = useState<ClinicServiceItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<
    Array<{ id: string; name: string; sku: string; unitPrice: number; quantity: number }>
  >([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [advancePayments, setAdvancePayments] = useState<PatientAdvancePaymentItem[]>([]);

  // Add Service Form
  const [serviceForm, setServiceForm] = useState({
    serviceId: '',
    quantity: 1,
    unitPrice: 0,
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: 0,
  });

  // Add Product Form
  const [productForm, setProductForm] = useState({
    inventoryItemId: '',
    quantity: 1,
    unitPrice: 0,
  });

  // Payment Form
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethodId: '',
    amount: 0,
    useAdvance: false,
    advancePaymentId: '',
    advanceUsed: 0,
    allocation: 'BOTH' as 'SERVICES' | 'PRODUCTS' | 'BOTH',
    notes: '',
  });

  // Load paginated audit logs
  const fetchAuditLogs = useCallback(
    async (incomeRecordId: string, page = 1, limit = auditLimit) => {
      try {
        setAuditLoading(true);
        const res = await incomeService.getAudit(incomeRecordId, { page, limit });
        setAuditLogs(res.records || []);
        setAuditTotal(res.total || 0);
        setAuditTotalPages(res.totalPages || 1);
        setAuditPage(page);
      } catch (err) {
        console.error('Failed to load audit logs', err);
      } finally {
        setAuditLoading(false);
      }
    },
    [auditLimit]
  );

  // Load Record & Associated Metadata
  const loadIncomeDetails = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      const detail = await incomeService.getByAppointment(appointmentId);
      setRecord(detail);

      if (detail?.id) {
        const [varData, auditData] = await Promise.allSettled([
          incomeService.getVariance(detail.id),
          incomeService.getAudit(detail.id, { page: 1, limit: auditLimit }),
        ]);
        if (varData.status === 'fulfilled') setVariance(varData.value);
        if (auditData.status === 'fulfilled') {
          const res = auditData.value;
          setAuditLogs(res.records || []);
          setAuditTotal(res.total || 0);
          setAuditTotalPages(res.totalPages || 1);
          setAuditPage(1);
        }
      }

      // Fetch patient available advance balance
      if (detail?.patient?.id) {
        try {
          const advRes = await clinicAdvancePaymentService.getPatientAdvancePayments(detail.patient.id, {
            status: 'AVAILABLE',
            limit: 50,
          });
          setPatientAdvanceBalance(Number(advRes?.totalAvailableBalance || 0));
          setAdvancePayments(advRes?.payments || []);
        } catch (e) {
          console.warn('Could not load patient advance payments', e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load income details', err);
      toastError(
        err?.response?.data?.message ||
          (isSpanish ? 'Error al cargar detalles de ingresos' : 'Failed to load income details')
      );
    } finally {
      setLoading(false);
    }
  }, [appointmentId, isSpanish, toastError, auditLimit]);

  useEffect(() => {
    loadIncomeDetails();
  }, [loadIncomeDetails]);

  // Load Doctor Services when Service Modal opens
  const handleOpenAddService = async () => {
    if (!record || !canManageServicesAndProducts) return;
    try {
      const docId = record.doctor.id;
      const res = await clinicServiceService.getByDoctor(docId);
      const activeSvcs = (res || []).filter((s: ClinicServiceItem) => !s.status || s.status === 'ACTIVE');
      setAvailableServices(activeSvcs);
      if (activeSvcs.length > 0) {
        setServiceForm({
          serviceId: activeSvcs[0].id,
          quantity: 1,
          unitPrice: Number(activeSvcs[0].price || 0),
          discountType: 'PERCENTAGE',
          discountValue: 0,
        });
      }
      setShowAddServiceModal(true);
    } catch (err) {
      console.error('Failed to load doctor services', err);
      toastError(isSpanish ? 'Error al cargar servicios del doctor' : 'Failed to load doctor services');
    }
  };

  // Load Inventory Products when Product Modal opens
  const handleOpenAddProduct = async () => {
    if (!record || !canManageServicesAndProducts) return;
    try {
      const res = await api.get('/inventory/items', { params: { limit: 100 } });
      const items = res.data?.items || [];
      const activeItems = items.filter((it: any) => it.quantity > 0);
      setAvailableProducts(activeItems);
      if (activeItems.length > 0) {
        setProductForm({
          inventoryItemId: activeItems[0].id,
          quantity: 1,
          unitPrice: Number(activeItems[0].unitPrice || 0),
        });
      }
      setShowAddProductModal(true);
    } catch (err) {
      console.error('Failed to load inventory items', err);
      toastError(isSpanish ? 'Error al cargar productos de inventario' : 'Failed to load inventory products');
    }
  };

  // Load Payment Methods and Advances when Payment Modal opens
  const handleOpenPayment = async () => {
    if (!record || !canRecordPayments) return;
    try {
      const methods = await paymentMethodService.getAll({
        moduleKey: 'CLINIC',
        activeOnly: true,
      });
      const validMethods = methods.filter((m) => m.type === 'INCOME' || m.type === 'BOTH');
      setPaymentMethods(validMethods);

      let advances: PatientAdvancePaymentItem[] = [];
      try {
        const advRes = await clinicAdvancePaymentService.getPatientAdvancePayments(record.patient.id, {
          status: 'AVAILABLE',
          limit: 20,
        });
        advances = advRes.payments || [];
        setPatientAdvanceBalance(Number(advRes?.totalAvailableBalance || 0));
      } catch (e) {
        console.warn('No advance balance found or error fetching advances', e);
      }
      setAdvancePayments(advances);

      const balDue = totalPendingAmount > 0 ? totalPendingAmount : Math.max(0, Number(record.balanceDue || 0));
      setPaymentForm({
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethodId: validMethods[0]?.id || '',
        amount: balDue,
        useAdvance: false,
        advancePaymentId: advances[0]?.id || '',
        advanceUsed: 0,
        allocation: 'BOTH',
        notes: '',
      });
      setShowPaymentModal(true);
    } catch (err) {
      console.error('Failed to prepare payment dialog', err);
      toastError(isSpanish ? 'Error al abrir diálogo de pago' : 'Failed to open payment modal');
    }
  };

  // Add Service Line Submit
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !serviceForm.serviceId) return;
    try {
      setSubmittingService(true);
      await incomeService.addServiceLine(record.id, {
        serviceId: serviceForm.serviceId,
        doctorId: record.doctor.id,
        quantity: Number(serviceForm.quantity),
        unitPrice: Number(serviceForm.unitPrice),
        discountType: serviceForm.discountType,
        discountValue: Number(serviceForm.discountValue),
      });
      success(isSpanish ? 'Servicio agregado exitosamente' : 'Service added successfully');
      setShowAddServiceModal(false);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to add service', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al agregar servicio' : 'Failed to add service'));
    } finally {
      setSubmittingService(false);
    }
  };

  // Open Edit Service Modal
  const handleOpenEditService = (line: IncomeServiceLineItem) => {
    setEditingServiceLine(line);
    setEditServiceForm({
      quantity: Number(line.quantity || 1),
      unitPrice: Number(line.unitPrice || 0),
      discountType: line.discountType || 'PERCENTAGE',
      discountValue: Number(line.discountValue || 0),
    });
  };

  // Submit Edit Service Line
  const handleEditServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !editingServiceLine) return;
    try {
      setSubmittingService(true);
      await incomeService.updateServiceLine(record.id, editingServiceLine.id, {
        quantity: Number(editServiceForm.quantity),
        unitPrice: Number(editServiceForm.unitPrice),
        discountType: editServiceForm.discountType,
        discountValue: Number(editServiceForm.discountValue),
      });
      success(isSpanish ? 'Servicio actualizado exitosamente' : 'Service updated successfully');
      setEditingServiceLine(null);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to update service', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al actualizar servicio' : 'Failed to update service'));
    } finally {
      setSubmittingService(false);
    }
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (prod: IncomeProductLineItem) => {
    setEditingProductLine(prod);
    setEditProductForm({
      quantity: Number(prod.quantity || 1),
    });
  };

  // Submit Edit Product Line
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !editingProductLine) return;
    try {
      setSubmittingProduct(true);
      await incomeService.updateProductLine(record.id, editingProductLine.id, {
        quantity: Number(editProductForm.quantity),
      });
      success(
        isSpanish
          ? 'Cantidad de producto actualizada y stock sincronizado'
          : 'Product quantity updated and stock synchronized'
      );
      setEditingProductLine(null);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to update product quantity', err);
      toastError(
        err?.response?.data?.message ||
          (isSpanish ? 'Error al actualizar cantidad del producto' : 'Failed to update product quantity')
      );
    } finally {
      setSubmittingProduct(false);
    }
  };

  // Add Product Line Submit
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !productForm.inventoryItemId) return;
    try {
      setSubmittingProduct(true);
      await incomeService.addProductLine(record.id, {
        inventoryItemId: productForm.inventoryItemId,
        quantity: Number(productForm.quantity),
        unitPrice: Number(productForm.unitPrice),
      });
      success(
        isSpanish
          ? 'Producto agregado y stock de inventario actualizado'
          : 'Product added and inventory stock updated'
      );
      setShowAddProductModal(false);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to add product', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al agregar producto' : 'Failed to add product'));
    } finally {
      setSubmittingProduct(false);
    }
  };

  // Confirm and Mark Service as Completed (Irreversible)
  const handleConfirmCompleteService = async () => {
    if (!record || !confirmCompleteServiceLine) return;
    try {
      setTogglingLineId(confirmCompleteServiceLine.id);
      await incomeService.toggleServiceComplete(record.id, confirmCompleteServiceLine.id);
      success(isSpanish ? 'Servicio marcado como Completado' : 'Service marked as Completed');
      setConfirmCompleteServiceLine(null);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to complete service', err);
      toastError(
        err?.response?.data?.message ||
          (isSpanish ? 'Error al completar el servicio' : 'Failed to complete service')
      );
    } finally {
      setTogglingLineId(null);
    }
  };

  // Delete Service Line
  const handleDeleteServiceConfirm = async () => {
    if (!record || !deletingServiceLine) return;
    try {
      await incomeService.removeServiceLine(record.id, deletingServiceLine.id);
      success(isSpanish ? 'Servicio eliminado exitosamente' : 'Service deleted successfully');
      setDeletingServiceLine(null);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to delete service line', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al eliminar servicio' : 'Failed to delete service'));
    }
  };

  // Delete Product Line
  const handleDeleteProductConfirm = async () => {
    if (!record || !deletingProductLine) return;
    try {
      await incomeService.removeProductLine(record.id, deletingProductLine.id);
      success(
        isSpanish
          ? 'Producto eliminado y stock restaurado en inventario'
          : 'Product removed and stock restored in inventory'
      );
      setDeletingProductLine(null);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to delete product line', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al eliminar producto' : 'Failed to remove product'));
    }
  };

  // Submit Payment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !paymentForm.paymentMethodId) {
      toastError(isSpanish ? 'Seleccione un método de pago' : 'Please select a payment method');
      return;
    }
    try {
      setSubmittingPayment(true);
      await incomeService.addPayment(record.id, {
        paymentDate: paymentForm.paymentDate,
        paymentMethodId: paymentForm.paymentMethodId,
        amount: Number(paymentForm.amount || 0),
        advancePaymentId: paymentForm.useAdvance ? paymentForm.advancePaymentId : undefined,
        advanceUsed: paymentForm.useAdvance ? Number(paymentForm.advanceUsed || 0) : 0,
        allocation: paymentForm.allocation,
        notes: paymentForm.notes.trim() || undefined,
      });
      success(isSpanish ? 'Pago registrado exitosamente' : 'Payment recorded successfully');
      setShowPaymentModal(false);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to record payment', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al registrar el pago' : 'Failed to record payment'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  // End Appointment
  const handleEndAppointment = async () => {
    if (!appointmentId) return;
    try {
      setEndingAppointment(true);
      await api.patch(`/clinic/appointments/${appointmentId}/status`, { status: 'COMPLETED' });
      success(isSpanish ? 'Cita finalizada exitosamente (Completada)' : 'Appointment ended successfully (Completed)');
      setShowEndModal(false);
      await loadIncomeDetails();
    } catch (err: any) {
      console.error('Failed to end appointment', err);
      toastError(err?.response?.data?.message || (isSpanish ? 'Error al finalizar la cita' : 'Failed to end appointment'));
    } finally {
      setEndingAppointment(false);
    }
  };

  // Dropdown options for Add Service modal
  const serviceOptions: SearchableSelectOption[] = useMemo(() => {
    return availableServices.map((svc) => ({
      value: svc.id,
      label: svc.name,
      sublabel: `$${Number(svc.price).toFixed(2)}`,
    }));
  }, [availableServices]);

  // Dropdown options for Add Product modal
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return availableProducts.map((prod) => ({
      value: prod.id,
      label: prod.name,
      sublabel: `SKU: ${prod.sku} • Stock: ${prod.quantity} • $${Number(prod.unitPrice).toFixed(2)}`,
    }));
  }, [availableProducts]);

  // Dropdown options for Payment Method modal
  const paymentMethodOptions: SearchableSelectOption[] = useMemo(() => {
    return paymentMethods.map((m) => ({
      value: m.id,
      label: m.name,
      badge: m.type,
    }));
  }, [paymentMethods]);

  // Dropdown options for Advance Receipts
  const advanceReceiptOptions: SearchableSelectOption[] = useMemo(() => {
    return advancePayments.map((adv) => ({
      value: adv.id,
      label: `${adv.receiptNumber}`,
      sublabel: `Balance: $${Number(adv.balanceRemaining).toFixed(2)}`,
    }));
  }, [advancePayments]);

  // Calculated Pending vs Completed Amounts for Financial Summary
  // NOTE: Only COMPLETED services that are UNPAID are considered pending services!
  const pendingServicesAmount = useMemo(() => {
    if (!record?.serviceLines) return 0;
    return record.serviceLines
      .filter((line) => line.isCompleted && line.paymentStatus !== 'PAID')
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [record]);

  const pendingProductsAmount = useMemo(() => {
    if (!record?.productLines) return 0;
    return record.productLines
      .filter((line) => line.paymentStatus !== 'PAID')
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [record]);

  const settledServicesAmount = useMemo(() => {
    if (!record?.serviceLines) return 0;
    return record.serviceLines
      .filter((line) => line.paymentStatus === 'PAID')
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [record]);

  const completedProductsAmount = useMemo(() => {
    if (!record?.productLines) return 0;
    return record.productLines
      .filter((line) => line.paymentStatus === 'PAID')
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  }, [record]);

  const totalPendingAmount = useMemo(() => {
    return pendingServicesAmount + pendingProductsAmount;
  }, [pendingServicesAmount, pendingProductsAmount]);

  const selectedAdvanceBalance = useMemo(() => {
    if (!paymentForm.advancePaymentId) return 0;
    const found = advancePayments.find((a) => a.id === paymentForm.advancePaymentId);
    return found ? Number(found.balanceRemaining || 0) : 0;
  }, [advancePayments, paymentForm.advancePaymentId]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '12px',
        }}
      >
        <RefreshCw size={28} style={{ color: 'var(--primary-600)', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {isSpanish ? 'Cargando registro de ingresos...' : 'Loading income record...'}
        </p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center' }}>
        <AlertCircle size={44} style={{ color: 'var(--rose-500)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 8px' }}>
          {isSpanish ? 'Registro no encontrado' : 'Record Not Found'}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
          {isSpanish
            ? 'No se pudo encontrar el registro de ingresos para esta cita.'
            : 'Could not find the income record associated with this appointment.'}
        </p>
        <button
          onClick={() => navigate('/clinic/appointments')}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
        >
          <ArrowLeft size={16} />
          <span>{t('income.backToAppointments', 'Back to Appointments')}</span>
        </button>
      </div>
    );
  }

  const patientFullName = [
    record.patient.firstName,
    record.patient.fatherLastName,
    record.patient.motherLastName,
  ]
    .filter(Boolean)
    .join(' ');

  const isAppointmentScheduled = record.appointment.status === 'SCHEDULED';
  const isAppointmentInProgress = record.appointment.status === 'IN_PROGRESS';
  const isAppointmentEnded = record.appointment.status === 'COMPLETED';
  const isAppointmentCancelled = record.appointment.status === 'CANCELLED';

  // Can manage services and products ONLY when appointment is IN_PROGRESS
  const canManageServicesAndProducts = isAppointmentInProgress && !isAppointmentEnded && !isAppointmentCancelled;

  // Can record payments when appointment is IN_PROGRESS or COMPLETED (not SCHEDULED or CANCELLED)
  const canRecordPayments = (isAppointmentInProgress || isAppointmentEnded) && !isAppointmentCancelled;

  // Compute Income Financial Status
  const isIncomePaid = Number(record.balanceDue || 0) <= 0 && (Number(record.totalPaid || 0) > 0 || Number(record.grandTotal || 0) === 0);
  const isIncomePartiallyPaid = Number(record.totalPaid || 0) > 0 && Number(record.balanceDue || 0) > 0;

  const incomeStatusBadgeClass =
    isAppointmentScheduled
      ? 'badge-secondary'
      : isIncomePaid
      ? 'badge-success'
      : isIncomePartiallyPaid
      ? 'badge-info'
      : 'badge-warning';

  const incomeStatusLabel =
    isAppointmentScheduled
      ? t('income.statusNotStarted', 'Not Started')
      : isIncomePaid
      ? t('income.statusPaid', 'Paid')
      : isIncomePartiallyPaid
      ? t('income.statusPartiallyPaid', 'Partially Paid')
      : t('income.statusUnpaid', 'Pending');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingBottom: '32px',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Tooltip content={t('income.backToAppointments', 'Back to Appointments')}>
            <button
              type="button"
              onClick={() => navigate('/clinic/appointments')}
              className="btn btn-secondary btn-icon"
              style={{ marginTop: '2px', flexShrink: 0 }}
              aria-label={t('income.backToAppointments', 'Back to Appointments')}
            >
              <ArrowLeft size={16} />
            </button>
          </Tooltip>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {t('income.incomeDetailTitle', 'Appointment Income & Billing')}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {record.appointment.appointmentNumber}
              </span>

              {/* ONLY DISPLAY INCOME STATUS BADGE */}
              <span
                className={`badge ${incomeStatusBadgeClass}`}
                style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 700 }}
              >
                {incomeStatusLabel}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {t('income.pageSubtitle', 'Manage appointment revenue, services, products, and collection records')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAppointmentInProgress && (
            <button
              type="button"
              onClick={() => setShowEndModal(true)}
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: 'var(--emerald-600)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle size={15} />
              <span>{t('income.endAppointment', 'End Appointment')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const nextTab = activeTab === 'income' ? 'audit' : 'income';
              setActiveTab(nextTab);
              if (nextTab === 'audit' && record?.id) {
                fetchAuditLogs(record.id, auditPage, auditLimit);
              }
            }}
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <History size={15} />
            <span>
              {activeTab === 'audit'
                ? isSpanish
                  ? 'Ver Facturación'
                  : 'View Billing'
                : t('income.auditSection', 'Audit History')}
            </span>
          </button>
        </div>
      </div>

      {/* Appointment Scheduled (Not Started) Warning Banner */}
      {isAppointmentScheduled && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13.5px',
            color: '#b45309',
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px', color: '#92400e' }}>
              {isSpanish ? 'Cita No Iniciada' : 'Appointment Not Started'}
            </strong>
            <span>
              {isSpanish
                ? 'Esta cita está en estado Programada. No se permite agregar, editar ni completar servicios o productos, ni registrar pagos hasta que la cita sea iniciada desde la lista de citas.'
                : 'This appointment has not started yet. Managing services, products, and recording payments is disabled until the appointment is started from the appointment list.'}
            </span>
          </div>
        </div>
      )}

      {/* Appointment Ended Lock Notice */}
      {isAppointmentEnded && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13.5px',
            color: 'var(--text-heading)',
          }}
        >
          <ShieldAlert size={20} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>
              {isSpanish ? 'Cita Finalizada' : 'Appointment Completed'}
            </strong>
            <span>
              {t(
                'income.appointmentEndedLocked',
                isSpanish
                  ? 'La cita ha finalizado. No se pueden agregar, editar ni eliminar servicios o productos. Solo se permite liquidar el saldo pendiente.'
                  : 'Appointment ended. Services and products cannot be added, edited, or deleted. Only pending balance settlement is permitted.'
              )}
            </span>
          </div>
        </div>
      )}

      {/* Appointment & Patient Info Card (5 Columns) */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '18px',
        }}
      >
        {/* Patient */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <User size={18} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('income.colPatient', 'Patient Name')}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
              {patientFullName}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
              {record.patient.recordNumber}
              {record.patient.phoneNumber && ` • ${record.patient.phoneNumber}`}
            </div>
          </div>
        </div>

        {/* Doctor */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: record.doctor.colorCode || 'var(--primary-600)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {record.doctor.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('income.colDoctor', 'Assigned Doctor')}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
              {record.doctor.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{record.doctor.email}</div>
          </div>
        </div>

        {/* Date & Schedule */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--badge-warning-bg)',
              color: 'var(--badge-warning-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('income.colDate', 'Appointment Date')}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '2px' }}>
              {new Date(record.appointment.date).toLocaleDateString()}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '2px',
              }}
            >
              <Clock size={13} />
              <span>
                {record.appointment.startTime} - {record.appointment.endTime}
              </span>
            </div>
          </div>
        </div>

        {/* Expected Amount */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--badge-success-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <DollarSign size={18} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('income.expectedAmount', 'Expected Amount')}
            </span>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              ${Number(record.appointment.expectedAmount || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {record.serviceLines.filter((l) => l.isCompleted).length} / {record.serviceLines.length}{' '}
              {isSpanish ? 'servicios completados' : 'services completed'}
            </div>
          </div>
        </div>

        {/* Patient Available Advance Balance */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Wallet size={18} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('income.advanceBalance', isSpanish ? 'Saldo de Anticipo' : 'Advance Balance')}
            </span>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: patientAdvanceBalance > 0 ? 'var(--emerald-600)' : 'var(--text-heading)',
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              ${patientAdvanceBalance.toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {patientAdvanceBalance > 0
                ? isSpanish
                  ? 'Disponible para aplicar'
                  : 'Available to apply'
                : isSpanish
                ? 'Sin saldo a favor'
                : 'No advance credit'}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'audit' ? (
        /* AUDIT TAB */
        <div className="card" style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
              }}
            >
              <History size={18} style={{ color: 'var(--primary-600)' }} />
              <span>{t('income.auditSection', 'Audit History')}</span>
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {auditTotal} {isSpanish ? 'registros' : 'records'}
            </span>
          </div>

          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>
                {isSpanish ? 'Cargando registros...' : 'Loading audit entries...'}
              </p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '14px' }}>
              {isSpanish ? 'No hay registros de auditoría aún.' : 'No audit entries recorded yet.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '11px', padding: '1px 6px' }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {log.resourceType}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                      {log.description || 'Activity performed'}
                    </div>
                    {log.user && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {isSpanish ? 'Por: ' : 'By: '}
                        <strong>{log.user.name}</strong> ({log.user.email})
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mandatory Table/List Pagination Standard (Rule 11) */}
          {auditTotal > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <Pagination
                currentPage={auditPage}
                totalPages={auditTotalPages}
                totalItems={auditTotal}
                pageSize={auditLimit}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={(p) => {
                  if (record?.id) {
                    fetchAuditLogs(record.id, p, auditLimit);
                  }
                }}
                onPageSizeChange={(sz) => {
                  setAuditLimit(sz);
                  if (record?.id) {
                    fetchAuditLogs(record.id, 1, sz);
                  }
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* MAIN BILLING & INCOME CONTENT */
        <>
          {/* Variance Flag Card */}
          {variance && (
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderLeft: `4px solid ${
                  variance.hasVariation
                    ? variance.variationType === 'HIGHER'
                      ? 'var(--sky-500)'
                      : 'var(--amber-500)'
                    : 'var(--emerald-500)'
                }`,
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {variance.hasVariation ? (
                  <AlertTriangle
                    size={22}
                    style={{
                      color: variance.variationType === 'HIGHER' ? 'var(--sky-500)' : 'var(--amber-500)',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  />
                ) : (
                  <CheckCircle size={22} style={{ color: 'var(--emerald-500)', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                      {variance.hasVariation
                        ? variance.variationType === 'HIGHER'
                          ? t('income.varianceHigher', 'Higher than Expected')
                          : t('income.varianceLower', 'Lower than Expected')
                        : t('income.noVariance', 'Matches Expected Amount')}
                    </h3>
                    <span
                      className={`badge ${
                        variance.difference > 0
                          ? 'badge-info'
                          : variance.difference < 0
                          ? 'badge-warning'
                          : 'badge-success'
                      }`}
                      style={{ fontSize: '11px', padding: '2px 8px', fontFamily: 'monospace', fontWeight: 700 }}
                    >
                      {variance.difference >= 0
                        ? `+$${variance.difference.toFixed(2)}`
                        : `-$${Math.abs(variance.difference).toFixed(2)}`}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {isSpanish
                      ? `Monto Planeado: $${variance.expectedAmount.toFixed(2)} | Monto Completado: $${variance.actualCompletedTotal.toFixed(2)}`
                      : `Planned Amount: $${variance.expectedAmount.toFixed(2)} | Completed Amount: $${variance.actualCompletedTotal.toFixed(2)}`}
                    {variance.pendingServicesCount > 0 && (
                      <span style={{ display: 'block', color: 'var(--amber-600)', marginTop: '2px', fontWeight: 600 }}>
                        • {variance.pendingServicesCount}{' '}
                        {isSpanish
                          ? `servicio(s) aún pendiente(s) ($${variance.pendingTotal.toFixed(2)})`
                          : `service(s) still pending ($${variance.pendingTotal.toFixed(2)})`}
                      </span>
                    )}
                    {variance.addedServicesCount > 0 && (
                      <span style={{ display: 'block', color: 'var(--primary-600)', marginTop: '2px', fontWeight: 600 }}>
                        • {variance.addedServicesCount}{' '}
                        {isSpanish ? 'servicio(s) adicional(es) agregado(s)' : 'additional service(s) added'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    display: 'block',
                  }}
                >
                  {t('income.actualCompletedAmount', 'Actual Completed Amount')}
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: 'var(--text-heading)',
                  }}
                >
                  ${variance.actualCompletedTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Section 1: Services Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}
                >
                  <FileText size={18} style={{ color: 'var(--primary-600)' }} />
                  <span>{t('income.servicesSection', 'Services')}</span>
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {isSpanish
                    ? 'Los servicios completados se integran al total general a facturar.'
                    : 'Completed services contribute to billable ledger calculations.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {canManageServicesAndProducts && (
                  <button
                    type="button"
                    onClick={handleOpenAddService}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={15} />
                    <span>{t('income.addService', 'Add Service')}</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', width: '70px' }}>
                      {t('income.colComplete', 'Complete')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('income.colService', 'Service')}
                    </th>
                    <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colQuantity', 'Qty')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {t('income.colAmount', 'Amount')}
                    </th>
                    <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colDiscount', 'Discount (%)')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {t('income.colTotal', 'Total')}
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colStatus', 'Status')}
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colPaymentStatus', 'Payment Status')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', width: '90px' }}>
                      {t('income.colActions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {record.serviceLines.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('income.noServicesYet', 'No services added to this income record.')}
                      </td>
                    </tr>
                  ) : (
                    record.serviceLines.map((line) => {
                      const canDelete = !line.isCompleted && line.paymentStatus !== 'PAID' && canManageServicesAndProducts;
                      const canEdit = !line.isCompleted && line.paymentStatus !== 'PAID' && canManageServicesAndProducts;

                      return (
                        <tr
                          key={line.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: line.isCompleted ? 'transparent' : 'rgba(245, 158, 11, 0.04)',
                          }}
                        >
                          {/* 1. Complete Action Column: Circular Indicator */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {line.isCompleted ? (
                              <Tooltip content={t('income.serviceCompleted', 'Completed')}>
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--emerald-600)',
                                    color: '#ffffff',
                                    margin: '0 auto',
                                    boxShadow: '0 1px 2px rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  <Check size={14} strokeWidth={3} />
                                </div>
                              </Tooltip>
                            ) : !canManageServicesAndProducts ? (
                              <Tooltip
                                content={
                                  isAppointmentScheduled
                                    ? isSpanish ? 'Cita no iniciada' : 'Appointment not started'
                                    : t('income.appointmentEndedBadge', 'Appointment Ended')
                                }
                              >
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: '2px solid var(--border-color)',
                                    backgroundColor: 'transparent',
                                    margin: '0 auto',
                                    opacity: 0.4,
                                    cursor: 'not-allowed',
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Tooltip content={t('income.markAsCompleted', 'Mark as Completed')}>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCompleteServiceLine(line)}
                                  disabled={togglingLineId === line.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: '2px solid var(--border-color)',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    margin: '0 auto',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--emerald-600)';
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  aria-label={t('income.markAsCompleted', 'Mark as Completed')}
                                />
                              </Tooltip>
                            )}
                          </td>

                          {/* 2. Service */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{line.serviceName}</div>
                            {line.isFromAppointment && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.4px',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {isSpanish ? 'Desde Cita' : 'From Appointment'}
                              </span>
                            )}
                          </td>

                          {/* 4. Qty */}
                          <td style={{ padding: '12px 12px', textAlign: 'center', fontFamily: 'monospace' }}>
                            {line.quantity}
                          </td>

                          {/* 5. Unit Price */}
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            ${Number(line.unitPrice).toFixed(2)}
                          </td>

                          {/* 6. Discount */}
                          <td style={{ padding: '12px 12px', textAlign: 'center', fontFamily: 'monospace' }}>
                            {Number(line.discountValue) > 0 ? `${Number(line.discountValue)}%` : '0%'}
                          </td>

                          {/* 7. Total */}
                          <td
                            style={{
                              padding: '12px 16px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--text-heading)',
                            }}
                          >
                            ${Number(line.lineTotal).toFixed(2)}
                          </td>

                          {/* 8. Service Status (Read-only) */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              className={`badge ${line.isCompleted ? 'badge-success' : 'badge-warning'}`}
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {line.isCompleted ? <Check size={12} /> : <Clock size={12} />}
                              <span>
                                {line.isCompleted
                                  ? t('income.serviceCompleted', 'Completed')
                                  : t('income.servicePending', 'Pending')}
                              </span>
                            </span>
                          </td>

                          {/* 9. Payment Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              className={`badge ${line.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}
                              style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 600 }}
                            >
                              {line.paymentStatus === 'PAID'
                                ? t('income.statusPaid', 'Paid')
                                : t('income.statusUnpaid', 'Pending')}
                            </span>
                          </td>

                          {/* 10. Actions (Edit & Delete) */}
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {canEdit && (
                                <Tooltip content={t('income.editService', 'Edit Service')}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditService(line)}
                                    className="btn-icon"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-600)' }}
                                    aria-label={t('income.editService', 'Edit Service')}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                </Tooltip>
                              )}
                              {canDelete ? (
                                <Tooltip content={isSpanish ? 'Eliminar servicio' : 'Delete service'}>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingServiceLine(line)}
                                    className="btn-icon btn-icon-danger"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                    aria-label={isSpanish ? 'Eliminar servicio' : 'Delete service'}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </Tooltip>
                              ) : (
                                <Tooltip content={t('income.cannotDeleteCompletedOrPaid', 'Completed or paid items cannot be deleted')}>
                                  <span
                                    style={{ color: 'var(--text-muted)', opacity: 0.4, cursor: 'not-allowed', display: 'inline-flex' }}
                                  >
                                    <Trash2 size={15} />
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Products & Inventory Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}
                >
                  <Package size={18} style={{ color: 'var(--primary-600)' }} />
                  <span>{t('income.productsSection', 'Products & Inventory')}</span>
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {isSpanish
                    ? 'Los productos reducen automáticamente el stock del inventario de la clínica.'
                    : 'Adding products automatically deducts Clinic Inventory stock.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {canManageServicesAndProducts && (
                  <button
                    type="button"
                    onClick={handleOpenAddProduct}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={15} />
                    <span>{t('income.addProduct', 'Add Product')}</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('income.colProduct', 'Product')}
                    </th>
                    <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colQuantity', 'Qty')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {t('income.colAmount', 'Unit Price')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {t('income.colTotal', 'Total')}
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t('income.colPaymentStatus', 'Payment Status')}
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', width: '90px' }}>
                      {t('income.colActions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {record.productLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('income.noProductsYet', 'No products added to this income record.')}
                      </td>
                    </tr>
                  ) : (
                    record.productLines.map((prod) => {
                      const canDelete = prod.paymentStatus !== 'PAID' && canManageServicesAndProducts;
                      const canEdit = prod.paymentStatus !== 'PAID' && canManageServicesAndProducts;

                      return (
                        <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{prod.productName}</div>
                            {prod.inventoryItem?.sku && (
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                SKU: {prod.inventoryItem.sku}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'center', fontFamily: 'monospace' }}>
                            {prod.quantity}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            ${Number(prod.unitPrice).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--text-heading)',
                            }}
                          >
                            ${Number(prod.lineTotal).toFixed(2)}
                          </td>

                          {/* Payment Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              className={`badge ${prod.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}
                              style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 600 }}
                            >
                              {prod.paymentStatus === 'PAID'
                                ? t('income.statusPaid', 'Paid')
                                : t('income.statusUnpaid', 'Pending')}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {canEdit && (
                                <Tooltip content={t('income.editProduct', 'Edit Product Quantity')}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditProduct(prod)}
                                    className="btn-icon"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-600)' }}
                                    aria-label={t('income.editProduct', 'Edit Product Quantity')}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                </Tooltip>
                              )}
                              {canDelete ? (
                                <Tooltip content={isSpanish ? 'Eliminar producto y restaurar stock' : 'Remove product & restore stock'}>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingProductLine(prod)}
                                    className="btn-icon btn-icon-danger"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                    aria-label={isSpanish ? 'Eliminar producto y restaurar stock' : 'Remove product & restore stock'}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </Tooltip>
                              ) : (
                                <Tooltip content={t('income.cannotDeleteCompletedOrPaid', 'Completed or paid items cannot be deleted')}>
                                  <span
                                    style={{ color: 'var(--text-muted)', opacity: 0.4, cursor: 'not-allowed', display: 'inline-flex' }}
                                  >
                                    <Trash2 size={15} />
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Financial Summary & Payments */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Financial Ledger Card */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {isSpanish ? 'Resumen Financiero' : 'Financial Summary'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {/* 1. Pending Services */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{t('income.pendingServicesTotal', 'Pending Services')}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-heading)' }}>
                    ${pendingServicesAmount.toFixed(2)}
                  </span>
                </div>

                {/* 2. Pending Products */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{t('income.pendingProductsTotal', 'Pending Products')}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-heading)' }}>
                    ${pendingProductsAmount.toFixed(2)}
                  </span>
                </div>

                {/* Separator line below these two fields */}
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                {/* 3. Total (Combined Pending Amount) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: 'var(--text-heading)',
                  }}
                >
                  <span>{t('income.totalPendingCombined', 'Total')}</span>
                  <span style={{ fontFamily: 'monospace' }}>${totalPendingAmount.toFixed(2)}</span>
                </div>

                {/* Separator line below the Total */}
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                {/* 4. Completed Service Amount (Same font size and styling as settled services text) */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{t('income.completedServiceAmount', 'Completed Service Amount')}</span>
                  <span style={{ fontFamily: 'monospace' }}>${settledServicesAmount.toFixed(2)}</span>
                </div>

                {/* 5. Completed Product Amount (Same font size and styling as settled services text) */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{t('income.completedProductAmount', 'Completed Product Amount')}</span>
                  <span style={{ fontFamily: 'monospace' }}>${completedProductsAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={!canRecordPayments || (totalPendingAmount <= 0 && Number(record.balanceDue) <= 0)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '10px 16px',
                  gap: '8px',
                  backgroundColor:
                    !canRecordPayments || (totalPendingAmount <= 0 && Number(record.balanceDue) <= 0)
                      ? 'var(--bg-secondary)'
                      : 'var(--emerald-600)',
                  color:
                    !canRecordPayments || (totalPendingAmount <= 0 && Number(record.balanceDue) <= 0)
                      ? 'var(--text-muted)'
                      : '#ffffff',
                  cursor:
                    !canRecordPayments || (totalPendingAmount <= 0 && Number(record.balanceDue) <= 0)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                <CreditCard size={16} />
                <span>{t('income.recordPayment', 'Record Payment')}</span>
              </button>
            </div>

            {/* Payment History Card (Without 'Total Settled' Column) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}
                >
                  <CreditCard size={16} style={{ color: 'var(--primary-600)' }} />
                  <span>{t('income.paymentHistory', 'Payment History')}</span>
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('income.colDate', 'Date')}
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {t('income.colMethod', 'Method')}
                      </th>
                      <th style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                        {t('income.colAllocation', 'Allocation')}
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                        {t('income.colDirectPayment', 'Payment Amount')}
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                        {t('income.colAdvanceAdjusted', 'Advance Adjusted')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {t('income.noPaymentsYet', 'No payments have been recorded yet.')}
                        </td>
                      </tr>
                    ) : (
                      record.payments.map((p) => {
                        const directCash = Number(p.amount || 0);
                        const advAdjusted = Number(p.advanceUsed || 0);

                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px' }}>
                              {new Date(p.paymentDate).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                                {p.paymentMethodName}
                              </div>
                              {p.notes && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.notes}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <span className="badge badge-info" style={{ fontSize: '11px', padding: '2px 6px' }}>
                                {p.allocation}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                              ${directCash.toFixed(2)}
                            </td>
                            <td
                              style={{
                                padding: '10px 14px',
                                textAlign: 'right',
                                fontFamily: 'monospace',
                                color: advAdjusted > 0 ? 'var(--primary-600)' : 'var(--text-muted)',
                              }}
                            >
                              {advAdjusted > 0 ? `$${advAdjusted.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL: ADD SERVICE (With SearchableSelect) */}
      {showAddServiceModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('income.addService', 'Add Service')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddServiceSubmit}>
              <div
                className="modal-body"
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.colService', 'Service')}
                  </label>
                  <SearchableSelect
                    options={serviceOptions}
                    value={serviceForm.serviceId}
                    onChange={(sid) => {
                      const found = availableServices.find((s) => s.id === sid);
                      setServiceForm((prev) => ({
                        ...prev,
                        serviceId: sid,
                        unitPrice: found ? Number(found.price || 0) : prev.unitPrice,
                      }));
                    }}
                    placeholder={isSpanish ? 'Seleccione un servicio...' : 'Select a service...'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colQuantity', 'Qty')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={serviceForm.quantity}
                      onChange={(e) =>
                        setServiceForm((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colAmount', 'Price ($)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={serviceForm.unitPrice}
                      onChange={(e) =>
                        setServiceForm((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.colDiscount', 'Discount (%)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={serviceForm.discountValue}
                    onChange={(e) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        discountValue: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      }))
                    }
                  />
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" disabled={submittingService} className="btn btn-primary btn-sm">
                  {submittingService
                    ? isSpanish
                      ? 'Guardando...'
                      : 'Saving...'
                    : t('income.addService', 'Add Service')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SERVICE */}
      {editingServiceLine && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('income.editService', 'Edit Service')}: {editingServiceLine.serviceName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingServiceLine(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditServiceSubmit}>
              <div
                className="modal-body"
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colQuantity', 'Qty')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={editServiceForm.quantity}
                      onChange={(e) =>
                        setEditServiceForm((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colAmount', 'Price ($)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={editServiceForm.unitPrice}
                      onChange={(e) =>
                        setEditServiceForm((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.colDiscount', 'Discount (%)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={editServiceForm.discountValue}
                    onChange={(e) =>
                      setEditServiceForm((prev) => ({
                        ...prev,
                        discountValue: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      }))
                    }
                  />
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
              >
                <button
                  type="button"
                  onClick={() => setEditingServiceLine(null)}
                  className="btn btn-secondary btn-sm"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" disabled={submittingService} className="btn btn-primary btn-sm">
                  {submittingService
                    ? isSpanish
                      ? 'Actualizando...'
                      : 'Updating...'
                    : isSpanish
                    ? 'Guardar Cambios'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT (With SearchableSelect) */}
      {showAddProductModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('income.addProduct', 'Add Product')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit}>
              <div
                className="modal-body"
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.colProduct', 'Inventory Product')}
                  </label>
                  <SearchableSelect
                    options={productOptions}
                    value={productForm.inventoryItemId}
                    onChange={(pid) => {
                      const found = availableProducts.find((p) => p.id === pid);
                      setProductForm((prev) => ({
                        ...prev,
                        inventoryItemId: pid,
                        unitPrice: found ? Number(found.unitPrice || 0) : prev.unitPrice,
                      }));
                    }}
                    placeholder={isSpanish ? 'Seleccione un producto...' : 'Select a product...'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colQuantity', 'Qty')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={productForm.quantity}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.colAmount', 'Unit Price ($)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={productForm.unitPrice}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))
                      }
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--badge-warning-bg)',
                    color: 'var(--badge-warning-text)',
                    fontSize: '12px',
                  }}
                >
                  {isSpanish
                    ? 'Aviso: Al agregar este producto, el stock en inventario se reducirá automáticamente.'
                    : 'Notice: Adding this product will immediately decrement Clinic Inventory stock.'}
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" disabled={submittingProduct} className="btn btn-primary btn-sm">
                  {submittingProduct
                    ? isSpanish
                      ? 'Guardando...'
                      : 'Saving...'
                    : t('income.addProduct', 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT QUANTITY */}
      {editingProductLine && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('income.editProduct', 'Edit Product Quantity')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProductLine(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditProductSubmit}>
              <div
                className="modal-body"
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {editingProductLine.productName}
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.colQuantity', 'Qty')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editProductForm.quantity}
                    onChange={(e) =>
                      setEditProductForm({
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    required
                  />
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {isSpanish
                    ? 'El stock en inventario se ajustará automáticamente según el cambio de cantidad.'
                    : 'Inventory stock will automatically be adjusted based on the quantity change.'}
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
              >
                <button
                  type="button"
                  onClick={() => setEditingProductLine(null)}
                  className="btn btn-secondary btn-sm"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button type="submit" disabled={submittingProduct} className="btn btn-primary btn-sm">
                  {submittingProduct
                    ? isSpanish
                      ? 'Actualizando...'
                      : 'Updating...'
                    : isSpanish
                    ? 'Guardar Cambios'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM SERVICE COMPLETION (Irreversible Alert) */}
      {confirmCompleteServiceLine && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', width: '95%' }}>
            <div className="modal-header">
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={18} />
                <span>{t('income.confirmCompleteTitle', 'Complete Service')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setConfirmCompleteServiceLine(null)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  color: 'var(--badge-warning-text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  {t(
                    'income.confirmCompleteDesc',
                    'Are you sure you want to mark this service as completed? Once marked as completed, this action cannot be reverted.'
                  )}
                </span>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                  {confirmCompleteServiceLine.serviceName}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Qty: {confirmCompleteServiceLine.quantity} • Total: ${Number(confirmCompleteServiceLine.lineTotal).toFixed(2)}
                </div>
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
            >
              <button
                type="button"
                onClick={() => setConfirmCompleteServiceLine(null)}
                className="btn btn-secondary btn-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteService}
                disabled={togglingLineId === confirmCompleteServiceLine.id}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: 'var(--emerald-600)' }}
              >
                {togglingLineId === confirmCompleteServiceLine.id
                  ? isSpanish
                    ? 'Completando...'
                    : 'Completing...'
                  : isSpanish
                  ? 'Confirmar Completar'
                  : 'Confirm Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT (With SearchableSelect) */}
      {showPaymentModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('income.recordPayment', 'Record Payment')}
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div
                className="modal-body"
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.paymentDate', 'Payment Date')}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('income.paymentMethod', 'Payment Method')}
                    </label>
                    <SearchableSelect
                      options={paymentMethodOptions}
                      value={paymentForm.paymentMethodId}
                      onChange={(mid) => setPaymentForm((prev) => ({ ...prev, paymentMethodId: mid }))}
                      placeholder={isSpanish ? 'Seleccionar método...' : 'Select method...'}
                    />
                  </div>
                </div>

                {/* Patient Advance Balance */}
                {advancePayments.length > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={paymentForm.useAdvance}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            useAdvance: e.target.checked,
                            advanceUsed: e.target.checked
                              ? Math.min(Number(record?.balanceDue || 0), selectedAdvanceBalance)
                              : 0,
                          }))
                        }
                      />
                      <Wallet size={15} style={{ color: 'var(--primary-600)' }} />
                      <span>{t('income.useAdvance', 'Apply Patient Advance Balance')}</span>
                    </label>

                    {paymentForm.useAdvance && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '6px' }}>
                        <div>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              marginBottom: '2px',
                            }}
                          >
                            {isSpanish ? 'Recibo' : 'Receipt'}
                          </span>
                          <SearchableSelect
                            options={advanceReceiptOptions}
                            value={paymentForm.advancePaymentId}
                            onChange={(aid) => setPaymentForm((prev) => ({ ...prev, advancePaymentId: aid }))}
                            placeholder={isSpanish ? 'Seleccionar recibo...' : 'Select receipt...'}
                          />
                        </div>
                        <div>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              marginBottom: '2px',
                            }}
                          >
                            {t('income.advanceToApply', 'Advance Amount')}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={selectedAdvanceBalance}
                            className="input"
                            style={{ fontSize: '12px', padding: '6px 8px', fontFamily: 'monospace' }}
                            value={paymentForm.advanceUsed}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setPaymentForm((prev) => ({
                                ...prev,
                                advanceUsed: Math.min(selectedAdvanceBalance, val),
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Allocation */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.paymentAllocation', 'Payment Allocation')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'BOTH', label: t('income.allocBoth', 'Both') },
                      { id: 'SERVICES', label: t('income.allocServices', 'Services Only') },
                      { id: 'PRODUCTS', label: t('income.allocProducts', 'Products Only') },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentForm((prev) => ({ ...prev, allocation: opt.id as any }))}
                        className={`btn btn-sm ${paymentForm.allocation === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ justifyContent: 'center', fontSize: '12px', padding: '6px 4px' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Amount */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.paymentAmount', 'Payment Amount ($)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    style={{ fontFamily: 'monospace', fontWeight: 700 }}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                    }
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('income.notes', 'Notes / Remarks')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={isSpanish ? 'ej. Pago con tarjeta' : 'e.g. Card payment'}
                  />
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
              >
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: 'var(--emerald-600)' }}
                >
                  {submittingPayment
                    ? isSpanish
                      ? 'Registrando...'
                      : 'Processing...'
                    : t('income.recordPayment', 'Record Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE SERVICE */}
      {deletingServiceLine && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', width: '95%' }}>
            <div className="modal-header">
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--rose-500)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldAlert size={18} />
                <span>{isSpanish ? 'Eliminar Servicio' : 'Delete Service'}</span>
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                {t('income.deleteServiceConfirm', 'Are you sure you want to delete this service line?')}
              </p>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {deletingServiceLine.serviceName} (${Number(deletingServiceLine.lineTotal).toFixed(2)})
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
            >
              <button
                type="button"
                onClick={() => setDeletingServiceLine(null)}
                className="btn btn-secondary btn-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteServiceConfirm}
                className="btn btn-danger btn-sm"
              >
                {isSpanish ? 'Eliminar' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE PRODUCT */}
      {deletingProductLine && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', width: '95%' }}>
            <div className="modal-header">
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--amber-600)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Package size={18} />
                <span>{isSpanish ? 'Eliminar Producto' : 'Remove Product'}</span>
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                {t(
                  'income.deleteProductConfirm',
                  'Are you sure you want to delete this product? The deducted quantity will be restored to inventory stock.'
                )}
              </p>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {deletingProductLine.productName} ({deletingProductLine.quantity}x)
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
            >
              <button
                type="button"
                onClick={() => setDeletingProductLine(null)}
                className="btn btn-secondary btn-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteProductConfirm}
                className="btn btn-danger btn-sm"
              >
                {isSpanish ? 'Eliminar y Restaurar' : 'Delete & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: END APPOINTMENT */}
      {showEndModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', width: '95%' }}>
            <div className="modal-header">
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={18} />
                <span>{t('income.endAppointment', 'End Appointment')}</span>
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t(
                  'income.endAppointmentConfirm',
                  'Are you sure you want to end this appointment? This will mark it as Completed.'
                )}
              </p>
            </div>
            <div
              className="modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}
            >
              <button type="button" onClick={() => setShowEndModal(false)} className="btn btn-secondary btn-sm">
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleEndAppointment}
                disabled={endingAppointment}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: 'var(--emerald-600)' }}
              >
                {endingAppointment
                  ? t('income.endingAppointment', 'Ending appointment...')
                  : isSpanish
                  ? 'Finalizar Cita'
                  : 'End Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
