import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { SearchableSelect, SearchableSelectOption } from '../../components/common/SearchableSelect';
import { DateRangePicker, DateRange } from '../../components/common/DateRangePicker';
import { Tooltip } from '../../components/common/Tooltip';
import { incomeService, IncomeRecordSummary } from '../../services/incomeService';
import api from '../../services/api';
import {
  DollarSign,
  Search,
  Filter,
  Eye,
  User,
  Calendar,
  Clock,
  ArrowRight,
  RotateCcw,
  Receipt,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface DoctorOption {
  id: string;
  name: string;
  email: string;
  colorCode?: string | null;
}

const INCOME_STATUS_CONFIG: Record<
  string,
  { labelEn: string; labelEs: string; bg: string; color: string; border: string }
> = {
  NOT_STARTED: {
    labelEn: 'Not Started',
    labelEs: 'No iniciada',
    bg: 'rgba(148, 163, 184, 0.12)',
    color: '#64748b',
    border: 'rgba(148, 163, 184, 0.3)',
  },
  PENDING: {
    labelEn: 'Pending',
    labelEs: 'Pendiente',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#d97706',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  PARTIAL: {
    labelEn: 'Partially Paid',
    labelEs: 'Pago Parcial',
    bg: 'rgba(14, 165, 233, 0.12)',
    color: '#0284c7',
    border: 'rgba(14, 165, 233, 0.3)',
  },
  PAID: {
    labelEn: 'Paid',
    labelEs: 'Pagado',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#059669',
    border: 'rgba(16, 185, 129, 0.3)',
  },
};

export const ClinicIncomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { error } = useToast();
  const isSpanish = i18n.language?.startsWith('es');

  // List State
  const [records, setRecords] = useState<IncomeRecordSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: '',
    endDate: '',
    preset: 'all',
  });

  // Doctors for Filter
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/clinic/appointments/working-hours/doctors');
      const list = res.data?.doctors || (Array.isArray(res.data) ? res.data : []);
      setDoctors(list);
    } catch (err) {
      console.error('Failed to load clinic doctors', err);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Fetch Income Records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await incomeService.getAll({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        doctorId: doctorFilter !== 'ALL' ? doctorFilter : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });

      setRecords(res.records || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load income records';
      error(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, doctorFilter, dateRange, error]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setDoctorFilter('ALL');
    setDateRange({ startDate: '', endDate: '', preset: 'all' });
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter !== 'ALL' ||
      doctorFilter !== 'ALL' ||
      dateRange.startDate ||
      dateRange.endDate,
  );

  const doctorOptions: SearchableSelectOption[] = useMemo(() => {
    const opts: SearchableSelectOption[] = [
      { value: 'ALL', label: isSpanish ? 'Todos los Doctores' : 'All Doctors' },
    ];
    doctors.forEach((d) => {
      opts.push({ value: d.id, label: d.name });
    });
    return opts;
  }, [doctors, isSpanish]);

  const statusOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: isSpanish ? 'Todos los Estados' : 'All Statuses' },
      { value: 'NOT_STARTED', label: isSpanish ? 'No iniciada' : 'Not Started' },
      { value: 'PENDING', label: isSpanish ? 'Pendiente' : 'Pending' },
      { value: 'PARTIAL', label: isSpanish ? 'Pago Parcial' : 'Partially Paid' },
      { value: 'PAID', label: isSpanish ? 'Pagado' : 'Paid' },
    ],
    [isSpanish],
  );

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <DollarSign size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('income.listingTitle', isSpanish ? 'Registros de Ingresos' : 'Income Records')}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('income.listingSubtitle', isSpanish ? 'Registro completo de facturación e ingresos asociados a citas médicas' : 'Comprehensive log of all clinic appointment billing and income transactions')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('income.searchPlaceholder', isSpanish ? 'Buscar paciente o n° de cita...' : 'Search patient or appointment #...')}
              style={{ paddingLeft: '34px', width: '100%', height: '38px', fontSize: '13px' }}
            />
          </div>

          {/* Doctor Filter */}
          <div>
            <SearchableSelect
              options={doctorOptions}
              value={doctorFilter}
              onChange={(val) => {
                setDoctorFilter(val);
                setPage(1);
              }}
              placeholder={t('income.doctorFilter', isSpanish ? 'Doctor' : 'Doctor')}
            />
          </div>

          {/* Status Filter */}
          <div>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              placeholder={t('income.statusFilter', isSpanish ? 'Estado' : 'Status')}
            />
          </div>

          {/* Date Range Picker */}
          <div>
            <DateRangePicker
              value={dateRange}
              onChange={(dr) => {
                setDateRange(dr);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <RotateCcw size={13} />
              <span>{isSpanish ? 'Limpiar Filtros' : 'Reset Filters'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Income Records Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            {isSpanish ? 'Cargando registros de ingresos...' : 'Loading income records...'}
          </div>
        ) : records.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Receipt size={24} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
              {isSpanish ? 'No se encontraron registros de ingresos' : 'No income records found'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '380px' }}>
              {hasActiveFilters
                ? isSpanish
                  ? 'Intenta ajustar los filtros de búsqueda para ver más resultados.'
                  : 'Try adjusting your search filters to find more results.'
                : isSpanish
                ? 'Los registros de ingresos se crearán automáticamente al programar o iniciar citas médicas.'
                : 'Income records are generated automatically when appointments are scheduled or started.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('income.colPatient', isSpanish ? 'Nombre del Paciente' : 'Patient Name')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('income.colAppointmentNumber', isSpanish ? 'N° de Cita' : 'Appointment #')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('income.colDoctor', isSpanish ? 'Doctor' : 'Doctor')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('income.grandTotal', isSpanish ? 'Total General' : 'Grand Total')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('income.totalPaid', isSpanish ? 'Total Pagado' : 'Total Paid')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('income.colPendingAmount', isSpanish ? 'Monto Pendiente' : 'Pending Amount')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('income.colStatus', isSpanish ? 'Estado' : 'Status')}
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('income.colActions', isSpanish ? 'Acciones' : 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const patientFullName = `${rec.patient?.firstName || ''} ${rec.patient?.fatherLastName || ''}`.trim();
                  const aptNum = rec.appointment?.appointmentNumber || '—';
                  const docName = rec.doctor?.name || '—';
                  const docColor = rec.doctor?.colorCode || '#6366f1';
                  
                  const isScheduled = rec.appointment?.status === 'SCHEDULED';
                  const balDue = Number(rec.balanceDue || 0);
                  const paid = Number(rec.totalPaid || 0);
                  const grandTotal = Number(rec.grandTotal || 0);
                  const isPaid = balDue <= 0 && (paid > 0 || grandTotal === 0);
                  const isPartial = paid > 0 && balDue > 0;

                  const statusLabel =
                    isScheduled
                      ? t('income.statusNotStarted', isSpanish ? 'No iniciada' : 'Not Started')
                      : isPaid
                      ? t('income.statusPaid', isSpanish ? 'Pagado' : 'Paid')
                      : isPartial
                      ? t('income.statusPartiallyPaid', isSpanish ? 'Pago Parcial' : 'Partially Paid')
                      : t('income.statusUnpaid', isSpanish ? 'Pendiente' : 'Pending');

                  const statusBadgeClass =
                    isScheduled
                      ? 'badge-secondary'
                      : isPaid
                      ? 'badge-success'
                      : isPartial
                      ? 'badge-info'
                      : 'badge-warning';

                  return (
                    <tr
                      key={rec.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 1. Patient Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                          {patientFullName || '—'}
                        </div>
                        {rec.patient?.recordNumber && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Exp: {rec.patient.recordNumber}
                          </div>
                        )}
                      </td>

                      {/* 2. Appointment Number */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--primary-600)' }}>
                          {aptNum}
                        </div>
                        {rec.appointment?.date && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {String(rec.appointment.date).substring(0, 10)}
                          </div>
                        )}
                      </td>

                      {/* 3. Doctor */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: docColor,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500, color: 'var(--text-body)' }}>{docName}</span>
                        </div>
                      </td>

                      {/* 4. Grand Total */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        ${grandTotal.toFixed(2)}
                      </td>

                      {/* 5. Total Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--emerald-600)', fontWeight: 600 }}>
                        ${paid.toFixed(2)}
                      </td>

                      {/* 6. Pending Amount (Balance Due) */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {balDue > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--rose-500)' }}>
                            ${balDue.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--emerald-600)', fontWeight: 500 }}>
                            $0.00
                          </span>
                        )}
                      </td>

                      {/* 7. Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          className={`badge ${statusBadgeClass}`}
                          style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 600 }}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {rec.appointment?.status === 'SCHEDULED' ? (
                          <Tooltip
                            content={
                              isSpanish
                                ? 'La cita no ha comenzado. El cobro estará disponible cuando inicie la cita.'
                                : 'Appointment has not started yet. Billing is available once started.'
                            }
                          >
                            <span style={{ display: 'inline-flex' }}>
                              <button
                                type="button"
                                disabled
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  opacity: 0.5,
                                  cursor: 'not-allowed',
                                  pointerEvents: 'none',
                                }}
                                aria-label={isSpanish ? 'No iniciada' : 'Not Started'}
                              >
                                <DollarSign size={13} />
                                <span>{isSpanish ? 'No iniciada' : 'Not Started'}</span>
                              </button>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip content={isSpanish ? 'Gestionar Ingreso' : 'Manage Income'}>
                            <button
                              type="button"
                              onClick={() => navigate(`/clinic/appointments/${rec.appointmentId}/income`)}
                              className="btn btn-primary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                              aria-label={isSpanish ? 'Gestionar Ingreso' : 'Manage Income'}
                            >
                              <DollarSign size={13} />
                              <span>{isSpanish ? 'Gestionar' : 'Manage'}</span>
                            </button>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mandatory Pagination */}
        {totalCount > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={limit}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setLimit(sz);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
};
