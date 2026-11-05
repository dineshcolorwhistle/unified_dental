import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LayoutGrid,
  ListFilter,
  User,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { ToothIcon } from '../../components/common/ToothIcon';
import { Pagination } from '../../components/common/Pagination';
import { useToast } from '../../core/context/ToastContext';
import {
  clinicOdontogramService,
  PatientOdontogramResponse,
  PatientOdontogramTreatmentItem,
} from '../../services/clinicOdontogramService';
import {
  getToothZoneAndQuadrant,
  getSurfaceDisplayName,
  ToothZone,
  ToothQuadrant,
} from '../../components/clinic/PatientTeethChart';

type ZoneQuadKey = 'P_Q1' | 'A_Q1' | 'P_Q2' | 'A_Q2' | 'P_Q4' | 'A_Q4' | 'P_Q3' | 'A_Q3';

interface TreatmentSummaryRow {
  treatmentName: string;
  color?: string;
  counts: Record<ZoneQuadKey, number>;
  total: number;
}

const ZONE_QUAD_COLUMNS: { key: ZoneQuadKey; label: string; title: string }[] = [
  { key: 'P_Q1', label: 'P Q1', title: 'Posterior Quadrant 1' },
  { key: 'A_Q1', label: 'A Q1', title: 'Anterior Quadrant 1' },
  { key: 'P_Q2', label: 'P Q2', title: 'Posterior Quadrant 2' },
  { key: 'A_Q2', label: 'A Q2', title: 'Anterior Quadrant 2' },
  { key: 'P_Q4', label: 'P Q4', title: 'Posterior Quadrant 4' },
  { key: 'A_Q4', label: 'A Q4', title: 'Anterior Quadrant 4' },
  { key: 'P_Q3', label: 'P Q3', title: 'Posterior Quadrant 3' },
  { key: 'A_Q3', label: 'A Q3', title: 'Anterior Quadrant 3' },
];

export const PatientTreatmentPlanPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { error } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PatientOdontogramResponse | null>(null);

  // Summary Table Pagination (Rule 11)
  const [summaryPage, setSummaryPage] = useState<number>(1);
  const [summaryPageSize, setSummaryPageSize] = useState<number>(10);

  // Detail Table Pagination (Rule 11)
  const [detailPage, setDetailPage] = useState<number>(1);
  const [detailPageSize, setDetailPageSize] = useState<number>(10);

  const fetchPlanData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await clinicOdontogramService.getPatientOdontogram(patientId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load treatment plan data:', err);
      error(
        err.response?.data?.message ||
          t('patientTreatmentPlan.loadFailed', 'Failed to load patient treatment plan data.')
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, t, error]);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  const patient = data?.patient;
  const patientFullName = patient
    ? [patient.firstName, patient.fatherLastName, patient.motherLastName]
        .filter(Boolean)
        .join(' ')
    : '';

  const treatments = useMemo<PatientOdontogramTreatmentItem[]>(() => {
    return data?.treatments || [];
  }, [data?.treatments]);

  // Aggregate treatments by Treatment Name and Zone/Quadrant
  const summaryRows = useMemo<TreatmentSummaryRow[]>(() => {
    if (!treatments.length) return [];

    const map = new Map<string, TreatmentSummaryRow>();

    treatments.forEach((tr) => {
      const name = tr.treatmentName || tr.treatment?.name || 'Treatment';
      if (!map.has(name)) {
        map.set(name, {
          treatmentName: name,
          color: tr.color || tr.treatment?.color,
          counts: {
            P_Q1: 0,
            A_Q1: 0,
            P_Q2: 0,
            A_Q2: 0,
            P_Q4: 0,
            A_Q4: 0,
            P_Q3: 0,
            A_Q3: 0,
          },
          total: 0,
        });
      }

      const row = map.get(name)!;
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      const z = zone === 'POSTERIOR' ? 'P' : 'A';
      const colKey = `${z}_${quadrant}` as ZoneQuadKey;

      if (row.counts[colKey] !== undefined) {
        row.counts[colKey] += 1;
        row.total += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.treatmentName.localeCompare(b.treatmentName)
    );
  }, [treatments]);

  // Summary Table Paginated Slice
  const paginatedSummaryRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return summaryRows.slice(start, start + summaryPageSize);
  }, [summaryRows, summaryPage, summaryPageSize]);

  const totalSummaryPages = Math.max(1, Math.ceil(summaryRows.length / summaryPageSize));

  // Detail Table Paginated Slice
  const paginatedDetailRows = useMemo(() => {
    const start = (detailPage - 1) * detailPageSize;
    return treatments.slice(start, start + detailPageSize);
  }, [treatments, detailPage, detailPageSize]);

  const totalDetailPages = Math.max(1, Math.ceil(treatments.length / detailPageSize));

  // Column totals across all rows
  const columnTotals = useMemo(() => {
    const totals: Record<ZoneQuadKey, number> = {
      P_Q1: 0,
      A_Q1: 0,
      P_Q2: 0,
      A_Q2: 0,
      P_Q4: 0,
      A_Q4: 0,
      P_Q3: 0,
      A_Q3: 0,
    };
    let grandTotal = 0;

    summaryRows.forEach((row) => {
      ZONE_QUAD_COLUMNS.forEach((col) => {
        totals[col.key] += row.counts[col.key] || 0;
      });
      grandTotal += row.total;
    });

    return { totals, grandTotal };
  }, [summaryRows]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '32px',
          color: 'var(--text-muted, #64748b)',
        }}
      >
        <Loader2
          size={36}
          className="animate-spin"
          style={{ color: 'var(--primary-600, #0d9488)', marginBottom: '12px' }}
        />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>
          {t('patientTreatmentPlan.loading', 'Loading patient treatment plan...')}
        </span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ maxWidth: '900px', margin: '32px auto', padding: '0 20px' }}>
        <button
          type="button"
          onClick={() => navigate('/clinic/patients')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
        >
          <ArrowLeft size={16} />
          <span>{t('patientTreatmentPlan.backToPatients', 'Back to Patients')}</span>
        </button>
        <div
          className="card"
          style={{
            padding: '24px',
            backgroundColor: 'var(--badge-danger-bg, #ffe4e6)',
            borderColor: 'var(--rose-500, #f43f5e)',
            color: 'var(--badge-danger-text, #be123c)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderRadius: '12px',
          }}
        >
          <AlertCircle size={22} />
          <span style={{ fontWeight: 600 }}>
            {t('patientTreatmentPlan.notFound', 'Patient data not found.')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* ─── Top Header & Navigation Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/clinic/patients')}
            className="btn btn-secondary"
            style={{
              width: '38px',
              height: '38px',
              padding: 0,
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={t('patientTreatmentPlan.backToPatients', 'Back to Patients')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-heading, #0f172a)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {t('patientTreatmentPlan.pageTitle', 'Treatment Plan')}
            </h1>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted, #64748b)',
                marginTop: '2px',
              }}
            >
              {t('patientTreatmentPlan.summarySubtitle', 'Counts of clinical treatment per zone')}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(`/clinic/patients/${patient.id}/odontogram`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          <ToothIcon size={16} />
          <span>{t('patientTreatmentPlan.viewOdontogram', 'View Odontogram')}</span>
        </button>
      </div>

      {/* ─── Patient Basic Details (Only Name & Contact Info) ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          {/* Patient Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-primary-bg, rgba(13, 148, 136, 0.12))',
                color: 'var(--primary-600, #0d9488)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {t('patientTreatmentPlan.name', 'Patient Name')}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-heading, #0f172a)',
                  marginTop: '2px',
                }}
              >
                {patientFullName || t('common.unnamed', 'Unnamed Patient')}
              </div>
            </div>
          </div>

          {/* Contact Details (Phone & Email) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
            }}
          >
            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Phone size={16} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.phone', 'Phone')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient.phoneNumber
                    ? `${patient.phoneCountryCode || '+52'} ${patient.phoneNumber}`
                    : '—'}
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={16} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {t('patientTreatmentPlan.email', 'Email')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #1e293b)',
                  }}
                >
                  {patient.email || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Section: Treatments Summary (by Quadrant) ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        {/* Section Header matching Image 2 */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={18} style={{ color: 'var(--text-heading, #0f172a)' }} />
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-heading, #0f172a)',
                margin: 0,
              }}
            >
              {t('patientTreatmentPlan.summaryTitle', 'Treatments Summary (by Quadrant)')}
            </h2>
          </div>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 400,
            }}
          >
            {t('patientTreatmentPlan.summarySubtitle', 'Counts of clinical treatment per zone')}
          </span>
        </div>

        {/* Matrix Table */}
        {summaryRows.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <FileSpreadsheet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              {t(
                'patientTreatmentPlan.noTreatmentsFound',
                'No treatments marked on the odontogram yet.'
              )}
            </div>
          </div>
        ) : (
          <div
            className="table-responsive"
            style={{
              overflowX: 'auto',
              width: '100%',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              className="table"
              style={{
                width: '100%',
                minWidth: '760px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--table-th-bg, #f8fafc)',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                      width: '22%',
                    }}
                  >
                    {t('patientTreatmentPlan.treatment', 'Treatment')}
                  </th>
                  {ZONE_QUAD_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '12px 10px',
                        fontWeight: 600,
                        color: 'var(--text-muted, #64748b)',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                      title={col.title}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                      textAlign: 'right',
                      width: '10%',
                    }}
                  >
                    {t('patientTreatmentPlan.total', 'Total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSummaryRows.map((row) => (
                  <tr
                    key={row.treatmentName}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td
                      style={{
                        padding: '13px 18px',
                        fontWeight: 600,
                        color: 'var(--text-heading, #0f172a)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {row.color && (
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: row.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span>{row.treatmentName}</span>
                      </div>
                    </td>
                    {ZONE_QUAD_COLUMNS.map((col) => {
                      const count = row.counts[col.key] || 0;
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '13px 10px',
                            textAlign: 'center',
                            fontSize: '13px',
                            color:
                              count > 0
                                ? 'var(--text-main, #1e293b)'
                                : 'var(--text-subtle, #cbd5e1)',
                            fontWeight: count > 0 ? 600 : 400,
                          }}
                        >
                          {count > 0 ? count : '—'}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '13px 18px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--text-heading, #0f172a)',
                        fontSize: '13px',
                      }}
                    >
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    backgroundColor: 'var(--table-th-bg, #f8fafc)',
                    borderTop: '2px solid var(--border-color, #e2e8f0)',
                    fontWeight: 700,
                  }}
                >
                  <td
                    style={{
                      padding: '12px 18px',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    {t('patientTreatmentPlan.total', 'Total')}
                  </td>
                  {ZONE_QUAD_COLUMNS.map((col) => {
                    const colSum = columnTotals.totals[col.key] || 0;
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '12px 10px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                          color:
                            colSum > 0
                              ? 'var(--text-main, #1e293b)'
                              : 'var(--text-subtle, #cbd5e1)',
                        }}
                      >
                        {colSum > 0 ? colSum : '—'}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: '12px 18px',
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--primary-600, #0d9488)',
                    }}
                  >
                    {columnTotals.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Rule 11: Mandatory Table Pagination Component */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: 'var(--bg-card, #ffffff)',
          }}
        >
          <Pagination
            currentPage={summaryPage}
            totalPages={totalSummaryPages}
            totalItems={summaryRows.length}
            pageSize={summaryPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={(p) => setSummaryPage(p)}
            onPageSizeChange={(sz) => {
              setSummaryPageSize(sz);
              setSummaryPage(1);
            }}
          />
        </div>
      </div>

      {/* ─── Detailed Treatments Breakdown (Tooth-Level) ─── */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ListFilter size={18} style={{ color: 'var(--text-muted, #64748b)' }} />
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-heading, #0f172a)',
                margin: 0,
              }}
            >
              {t('patientTreatmentPlan.detailedListTitle', 'Treatments Detail')}
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
            {treatments.length} {t('patientTreatmentPlan.total', 'Total').toLowerCase()}
          </span>
        </div>

        {treatments.length === 0 ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '13px',
            }}
          >
            {t(
              'patientTreatmentPlan.noTreatmentsFound',
              'No treatments marked on the odontogram yet.'
            )}
          </div>
        ) : (
          <div
            className="table-responsive"
            style={{
              overflowX: 'auto',
              width: '100%',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              className="table"
              style={{
                width: '100%',
                minWidth: '680px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--table-th-bg, #f8fafc)',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                    }}
                  >
                    {t('patientTreatmentPlan.toothNumber', 'Tooth')}
                  </th>
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                    }}
                  >
                    {t('patientTreatmentPlan.surface', 'Surface')}
                  </th>
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                    }}
                  >
                    {t('patientTreatmentPlan.treatment', 'Treatment')}
                  </th>
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                    }}
                  >
                    {t('patientTreatmentPlan.status', 'Status')}
                  </th>
                  <th
                    style={{
                      padding: '12px 18px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                    }}
                  >
                    {t('patientTreatmentPlan.notes', 'Notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedDetailRows.map((item) => {
                  const statusKey =
                    item.status === 'COMPLETED'
                      ? 'statusCompleted'
                      : item.status === 'IN_PROGRESS'
                      ? 'statusInProgress'
                      : item.status === 'CANCELLED'
                      ? 'statusCancelled'
                      : 'statusPlanned';

                  const badgeBg =
                    item.status === 'COMPLETED'
                      ? 'var(--badge-success-bg, #dcfce7)'
                      : item.status === 'IN_PROGRESS'
                      ? 'var(--badge-warning-bg, #fef3c7)'
                      : item.status === 'CANCELLED'
                      ? 'var(--badge-danger-bg, #ffe4e6)'
                      : 'var(--badge-info-bg, #e0f2fe)';

                  const badgeColor =
                    item.status === 'COMPLETED'
                      ? 'var(--badge-success-text, #15803d)'
                      : item.status === 'IN_PROGRESS'
                      ? 'var(--badge-warning-text, #b45309)'
                      : item.status === 'CANCELLED'
                      ? 'var(--badge-danger-text, #be123c)'
                      : 'var(--badge-info-text, #0369a1)';

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 18px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: 'var(--text-heading, #0f172a)',
                        }}
                      >
                        #{item.toothNumber}
                      </td>
                      <td
                        style={{
                          padding: '12px 18px',
                          color: 'var(--text-main, #334155)',
                        }}
                      >
                        {getSurfaceDisplayName(item.surface, item.toothNumber)}
                      </td>
                      <td
                        style={{
                          padding: '12px 18px',
                          fontWeight: 600,
                          color: 'var(--text-heading, #0f172a)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.color && (
                            <span
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: item.color,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span>{item.treatmentName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {t(`patientTreatmentPlan.${statusKey}`, item.status)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 18px',
                          color: 'var(--text-muted, #64748b)',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rule 11: Mandatory Table Pagination Component */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: 'var(--bg-card, #ffffff)',
          }}
        >
          <Pagination
            currentPage={detailPage}
            totalPages={totalDetailPages}
            totalItems={treatments.length}
            pageSize={detailPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={(p) => setDetailPage(p)}
            onPageSizeChange={(sz) => {
              setDetailPageSize(sz);
              setDetailPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
};
