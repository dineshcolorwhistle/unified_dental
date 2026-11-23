import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Printer,
  ArrowLeft,
  Calendar,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { ToothIcon } from '../common/ToothIcon';
import { ToothZone, ToothQuadrant, getToothZoneAndQuadrant } from './PatientTeethChart';
import { ProposedGroup, ProposedItem, DoctorWithServices } from '../../pages/clinic/PatientTreatmentPlanPage';
import { ClinicServiceItem } from '../../services/clinicServiceService';
import { PatientOdontogramTreatmentItem } from '../../services/clinicOdontogramService';

export interface TreatmentPlanPrintViewProps {
  onBack: () => void;
  clinicName?: string;
  patient?: {
    id: string;
    recordNumber?: string;
    firstName: string;
    fatherLastName?: string;
    motherLastName?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
    email?: string;
  } | null;
  treatments: PatientOdontogramTreatmentItem[];
  planGroups: ProposedGroup[];
  doctors: DoctorWithServices[];
  clinicServices: ClinicServiceItem[];
  grandTotal: number;
}

interface QuadrantProcedureGroup {
  treatmentName: string;
  color?: string;
  toothNumbers: number[];
  count: number;
}

interface QuadrantDetail {
  key: ToothQuadrant;
  label: string;
  subLabel: string;
  totalCount: number;
  posterior: QuadrantProcedureGroup[];
  anterior: QuadrantProcedureGroup[];
}

export const TreatmentPlanPrintView: React.FC<TreatmentPlanPrintViewProps> = ({
  onBack,
  clinicName,
  patient,
  treatments,
  planGroups,
  doctors,
  clinicServices,
  grandTotal,
}) => {
  const { t } = useTranslation();

  const patientFullName = useMemo(() => {
    if (!patient) return '';
    return [patient.firstName, patient.fatherLastName, patient.motherLastName].filter(Boolean).join(' ');
  }, [patient]);

  const patientPhone = useMemo(() => {
    if (!patient || !patient.phoneNumber) return '';
    const code = patient.phoneCountryCode || '+52';
    return `${code} ${patient.phoneNumber}`;
  }, [patient]);

  const formattedDate = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  // Compute Arch & Zone Statistics
  const archStats = useMemo(() => {
    let maxilla = 0;
    let mandible = 0;
    let posterior = 0;
    let anterior = 0;

    treatments.forEach((tr) => {
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      if (quadrant === 'Q1' || quadrant === 'Q2') maxilla += 1;
      else mandible += 1;

      if (zone === 'POSTERIOR') posterior += 1;
      else anterior += 1;
    });

    return { maxilla, mandible, posterior, anterior, total: treatments.length };
  }, [treatments]);

  // Compute 4-Quadrant Anatomical Summary (Application-Native Style, NOT Reference Spreadsheet)
  const quadrantsData = useMemo<QuadrantDetail[]>(() => {
    const helperMap: Record<
      ToothQuadrant,
      {
        posteriorMap: Map<string, { treatmentName: string; color?: string; toothNumbers: number[]; count: number }>;
        anteriorMap: Map<string, { treatmentName: string; color?: string; toothNumbers: number[]; count: number }>;
        total: number;
      }
    > = {
      Q1: { posteriorMap: new Map(), anteriorMap: new Map(), total: 0 },
      Q2: { posteriorMap: new Map(), anteriorMap: new Map(), total: 0 },
      Q3: { posteriorMap: new Map(), anteriorMap: new Map(), total: 0 },
      Q4: { posteriorMap: new Map(), anteriorMap: new Map(), total: 0 },
    };

    treatments.forEach((tr) => {
      const { zone, quadrant } = getToothZoneAndQuadrant(tr.toothNumber);
      const name = tr.treatmentName || tr.treatment?.name || 'Treatment';
      const quad = helperMap[quadrant];
      quad.total += 1;

      const targetMap = zone === 'POSTERIOR' ? quad.posteriorMap : quad.anteriorMap;
      if (targetMap.has(name)) {
        const item = targetMap.get(name)!;
        if (!item.toothNumbers.includes(tr.toothNumber)) {
          item.toothNumbers.push(tr.toothNumber);
          item.toothNumbers.sort((a, b) => a - b);
        }
        item.count += 1;
      } else {
        targetMap.set(name, {
          treatmentName: name,
          color: tr.color || tr.treatment?.color,
          toothNumbers: [tr.toothNumber],
          count: 1,
        });
      }
    });

    return [
      {
        key: 'Q1',
        label: t('patientTreatmentPlan.quadrant1', 'Quadrant 1'),
        subLabel: t('patientTreatmentPlan.quadrant1Sub', 'Upper Right (Maxilla)'),
        totalCount: helperMap.Q1.total,
        posterior: Array.from(helperMap.Q1.posteriorMap.values()),
        anterior: Array.from(helperMap.Q1.anteriorMap.values()),
      },
      {
        key: 'Q2',
        label: t('patientTreatmentPlan.quadrant2', 'Quadrant 2'),
        subLabel: t('patientTreatmentPlan.quadrant2Sub', 'Upper Left (Maxilla)'),
        totalCount: helperMap.Q2.total,
        posterior: Array.from(helperMap.Q2.posteriorMap.values()),
        anterior: Array.from(helperMap.Q2.anteriorMap.values()),
      },
      {
        key: 'Q4',
        label: t('patientTreatmentPlan.quadrant4', 'Quadrant 4'),
        subLabel: t('patientTreatmentPlan.quadrant4Sub', 'Lower Right (Mandible)'),
        totalCount: helperMap.Q4.total,
        posterior: Array.from(helperMap.Q4.posteriorMap.values()),
        anterior: Array.from(helperMap.Q4.anteriorMap.values()),
      },
      {
        key: 'Q3',
        label: t('patientTreatmentPlan.quadrant3', 'Quadrant 3'),
        subLabel: t('patientTreatmentPlan.quadrant3Sub', 'Lower Left (Mandible)'),
        totalCount: helperMap.Q3.total,
        posterior: Array.from(helperMap.Q3.posteriorMap.values()),
        anterior: Array.from(helperMap.Q3.anteriorMap.values()),
      },
    ];
  }, [treatments, t]);

  // Quadrant Subtotals Across Proposed Items
  const quadrantSubtotals = useMemo(() => {
    const res = { q1: 0, q2: 0, q3: 0, q4: 0 };
    planGroups.forEach((group) => {
      group.items.forEach((item) => {
        const sub = item.subtotal || 0;
        if (item.quadrant === 'Q1') res.q1 += sub;
        else if (item.quadrant === 'Q2') res.q2 += sub;
        else if (item.quadrant === 'Q3') res.q3 += sub;
        else if (item.quadrant === 'Q4') res.q4 += sub;
      });
    });
    return res;
  }, [planGroups]);

  // Doctor & Service Lookups
  const getDoctorName = (doctorId: string): string => {
    if (!doctorId) return '—';
    const doc = doctors.find((d) => d.id === doctorId);
    return doc ? doc.name : '—';
  };

  const getServiceName = (doctorId: string, serviceId: string): string => {
    if (!serviceId) return '—';
    const doc = doctors.find((d) => d.id === doctorId);
    const docSrv = doc?.services?.find((s) => s.serviceId === serviceId);
    if (docSrv?.serviceName) return docSrv.serviceName;

    const baseSrv = clinicServices.find((s) => s.id === serviceId);
    return baseSrv?.name || '—';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="treatment-plan-print-page"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* ─── Embedded Clean Print Stylesheet ─── */}
      <style>{`
        @media screen and (max-width: 768px) {
          #printable-treatment-plan-document {
            padding: 20px 16px !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .treatment-plan-print-page {
            position: absolute !important;
            inset: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
          }
          #printable-treatment-plan-document,
          #printable-treatment-plan-document * {
            visibility: visible !important;
          }
          #printable-treatment-plan-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }
          .no-print-toolbar {
            display: none !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .treatment-plan-quadrant-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          @media (max-width: 640px) {
            .treatment-plan-quadrant-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @page {
            size: portrait;
            margin: 12mm 14mm;
          }
        }
      `}</style>

      {/* ─── Full-Page Print Navigation Header Toolbar ─── */}
      <div
        className="card no-print-toolbar"
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e2e8f0)',
          padding: '14px 20px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>{t('patientTreatmentPlan.backToPlan', 'Back to Treatment Plan')}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={18} style={{ color: 'var(--primary-600, #0d9488)' }} />
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', letterSpacing: '-0.01em' }}>
            {t('patientTreatmentPlan.printPreviewTitle', 'Treatment Plan Print Preview')}
          </span>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Printer size={16} />
          <span>{t('patientTreatmentPlan.printNow', 'Print Document')}</span>
        </button>
      </div>

      {/* ─── Printable Document Paper Container ─── */}
      <div
        id="printable-treatment-plan-document"
        className="card"
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid var(--border-color, #cbd5e1)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.08))',
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '26px',
          fontFamily: 'inherit',
          color: '#1e293b',
          boxSizing: 'border-box',
        }}
      >
        {/* 1. Clinic Branding & Document Header Card */}
        <div
          className="print-avoid-break"
          style={{
            borderBottom: '2.5px solid #0d9488',
            paddingBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(13, 148, 136, 0.1)',
                  color: '#0d9488',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1.5px solid rgba(13, 148, 136, 0.3)',
                }}
              >
                <ToothIcon size={30} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f766e',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {clinicName || t('common.clinic', 'Dental Clinic')}
                </div>
                <h1
                  style={{
                    fontSize: '25px',
                    fontWeight: 900,
                    color: '#0f172a',
                    margin: '3px 0 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t('patientTreatmentPlan.clinicTreatmentPlanTitle', 'Dental Treatment Plan')}
                </h1>
              </div>
            </div>

            {/* Document Date Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
              }}
            >
              <Calendar size={14} style={{ color: '#0d9488' }} />
              <span>
                {t('patientTreatmentPlan.dateOfIssue', 'Date of Issue')}: <strong>{formattedDate}</strong>
              </span>
            </div>
          </div>

          {/* Patient Details Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '18px',
              padding: '12px 18px',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={15} style={{ color: '#0d9488' }} />
              <span style={{ color: '#64748b', fontWeight: 500 }}>
                {t('patientTreatmentPlan.name', 'Patient Name')}:
              </span>
              <strong style={{ color: '#0f172a' }}>{patientFullName || '—'}</strong>
            </div>

            {patient?.recordNumber && (
              <>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                    {t('patientTreatmentPlan.recordNumber', 'Record #')}:
                  </span>
                  <strong style={{ color: '#0f172a' }}>{patient.recordNumber}</strong>
                </div>
              </>
            )}

            {patientPhone && (
              <>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} style={{ color: '#0d9488' }} />
                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                    {t('patientTreatmentPlan.contactNumber', 'Contact Number')}:
                  </span>
                  <strong style={{ color: '#0f172a' }}>{patientPhone}</strong>
                </div>
              </>
            )}

            {patient?.email && (
              <>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} style={{ color: '#0d9488' }} />
                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                    {t('patientTreatmentPlan.email', 'Email')}:
                  </span>
                  <strong style={{ color: '#0f172a' }}>{patient.email}</strong>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2. Treatments Summary Section — Application-Native 4-Quadrant Anatomical Cards (NOT Reference Spreadsheet) */}
        <div
          className="print-avoid-break"
          style={{
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Section Header */}
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} style={{ color: '#0d9488' }} />
              <h2
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t('patientTreatmentPlan.summaryTitle', 'Treatments Summary (by Quadrant)')}
              </h2>
            </div>

            {/* Quick Metrics Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b' }}>
                {t('patientTreatmentPlan.upperArch', 'Maxilla')}:{' '}
                <strong style={{ color: '#0f172a' }}>{archStats.maxilla}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>
                {t('patientTreatmentPlan.lowerArch', 'Mandible')}:{' '}
                <strong style={{ color: '#0f172a' }}>{archStats.mandible}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>
                {t('patientTreatmentPlan.posteriorZone', 'Posterior')}:{' '}
                <strong style={{ color: '#0d9488' }}>{archStats.posterior}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>
                {t('patientTreatmentPlan.anteriorZone', 'Anterior')}:{' '}
                <strong style={{ color: '#0d9488' }}>{archStats.anterior}</strong>
              </span>
            </div>
          </div>

          {/* 4-Quadrant Anatomical Cards Cross Grid (2 x 2 Layout) */}
          <div
            className="treatment-plan-quadrant-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#ffffff',
            }}
          >
            {quadrantsData.map((q) => (
              <div
                key={q.key}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Quadrant Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                      {q.label}
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{q.subLabel}</div>
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: q.totalCount > 0 ? 'rgba(13, 148, 136, 0.12)' : '#e2e8f0',
                      color: q.totalCount > 0 ? '#0f766e' : '#94a3b8',
                    }}
                  >
                    {q.totalCount} {q.totalCount === 1 ? t('patientTreatmentPlan.procedure', 'procedure') : t('patientTreatmentPlan.procedures', 'procedures')}
                  </span>
                </div>

                {/* Procedures List */}
                {q.totalCount === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                    {t('patientTreatmentPlan.noProceduresInQuad', 'No planned procedures in this quadrant')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Posterior Procedures */}
                    {q.posterior.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {t('patientTreatmentPlan.posteriorZone', 'Posterior')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {q.posterior.map((proc, pIdx) => (
                            <div
                              key={pIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#ffffff',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '11.5px',
                                flex: '1 1 auto',
                                minWidth: '120px',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: proc.color || '#0d9488',
                                  flexShrink: 0,
                                }}
                              />
                              <strong style={{ color: '#0f172a', whiteSpace: 'nowrap' }}>{proc.treatmentName}</strong>
                              <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                ({proc.toothNumbers.join(', ')})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Anterior Procedures */}
                    {q.anterior.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {t('patientTreatmentPlan.anteriorZone', 'Anterior')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {q.anterior.map((proc, aIdx) => (
                            <div
                              key={aIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#ffffff',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '11.5px',
                                flex: '1 1 auto',
                                minWidth: '120px',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: proc.color || '#0d9488',
                                  flexShrink: 0,
                                }}
                              />
                              <strong style={{ color: '#0f172a', whiteSpace: 'nowrap' }}>{proc.treatmentName}</strong>
                              <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                ({proc.toothNumbers.join(', ')})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Proposed Treatment Plan (Organized by Visits) */}
        <div
          className="print-avoid-break"
          style={{
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: '#0d9488' }} />
              <h2
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t('patientTreatmentPlan.proposedPlanTitle', 'Proposed Treatment Plan')}
              </h2>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              {planGroups.length} {t('patientTreatmentPlan.totalVisits', 'Visits')}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#334155' }}>
                    {t('patientTreatmentPlan.treatmentColumn', 'Treatment')}
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>
                    {t('patientTreatmentPlan.zoneQuadrantColumn', 'Zone / Quadrant')}
                  </th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>
                    {t('patientTreatmentPlan.qtyColumn', 'Qty')}
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>
                    {t('patientTreatmentPlan.doctorColumn', 'Doctor')}
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>
                    {t('patientTreatmentPlan.serviceColumn', 'Service')}
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                    {t('patientTreatmentPlan.unitPriceColumn', 'Unit Price')}
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                    {t('patientTreatmentPlan.subtotalColumn', 'Subtotal')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {planGroups.map((group) => {
                  const groupSubtotal = group.items.reduce((s, it) => s + (it.subtotal || 0), 0);

                  return (
                    <React.Fragment key={group.id}>
                      {/* Visit Group Header Row */}
                      <tr
                        style={{
                          backgroundColor: '#f1f5f9',
                          borderTop: '1px solid #cbd5e1',
                          borderBottom: '1px solid #cbd5e1',
                        }}
                      >
                        <td
                          colSpan={5}
                          style={{
                            padding: '8px 14px',
                            fontWeight: 800,
                            color: '#0f172a',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                backgroundColor: '#0d9488',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              #
                            </span>
                            <span>{group.name}</span>
                            {group.status && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >
                                {group.status}
                              </span>
                            )}
                            {group.confirmed && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >
                                <CheckCircle2 size={12} />
                                {t('patientTreatmentPlan.confirmed', 'Confirmed')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: '8px 14px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#0f766e',
                            fontSize: '12px',
                          }}
                        >
                          {t('patientTreatmentPlan.groupSubtotal', 'Group subtotal')}:{' '}
                          <strong>{groupSubtotal.toFixed(2)} MXN</strong>
                        </td>
                      </tr>

                      {/* Group Item Rows */}
                      {group.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              padding: '14px',
                              textAlign: 'center',
                              color: '#94a3b8',
                              fontStyle: 'italic',
                              fontSize: '11px',
                            }}
                          >
                            {t('patientTreatmentPlan.noTreatmentsInPlan', 'No treatments assigned to this visit.')}
                          </td>
                        </tr>
                      ) : (
                        group.items.map((item, iIdx) => (
                          <tr
                            key={item.id}
                            style={{
                              backgroundColor: iIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                          >
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {item.treatmentName}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>
                              {item.otTeethNumber ? item.otTeethNumber.replace(/#/g, '').trim() : item.zoneText || '—'}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                              {item.quantity}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {getDoctorName(item.doctorId)}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {getServiceName(item.doctorId, item.serviceId)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                              {(item.unitPrice || 0).toFixed(2)} MXN
                            </td>
                            <td
                              style={{
                                padding: '8px 14px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: '#0f172a',
                              }}
                            >
                              {(item.subtotal || 0).toFixed(2)} MXN
                            </td>
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quadrant Subtotals & Grand Total Section */}
          <div
            className="print-avoid-break"
            style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderTop: '2px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            {/* Quadrant Subtotals Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('patientTreatmentPlan.quadrantBreakdown', 'Quadrant Breakdown')}:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: '20px', rowGap: '4px' }}>
                <span style={{ color: '#64748b' }}>PQ1, AQ1:</span>
                <strong style={{ color: '#0f766e' }}>{quadrantSubtotals.q1.toFixed(2)} MXN</strong>

                <span style={{ color: '#64748b' }}>PQ2, AQ2:</span>
                <strong style={{ color: '#0f766e' }}>{quadrantSubtotals.q2.toFixed(2)} MXN</strong>

                <span style={{ color: '#64748b' }}>PQ4, AQ4:</span>
                <strong style={{ color: '#0f766e' }}>{quadrantSubtotals.q4.toFixed(2)} MXN</strong>

                <span style={{ color: '#64748b' }}>PQ3, AQ3:</span>
                <strong style={{ color: '#0f766e' }}>{quadrantSubtotals.q3.toFixed(2)} MXN</strong>
              </div>
            </div>

            {/* Grand Total Callout Box */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                padding: '12px 20px',
                borderRadius: '10px',
                backgroundColor: 'rgba(13, 148, 136, 0.08)',
                border: '1.5px solid rgba(13, 148, 136, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#0f766e',
                  letterSpacing: '0.05em',
                }}
              >
                {t('patientTreatmentPlan.grandTotal', 'Grand Total')}
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#0f766e',
                  letterSpacing: '-0.02em',
                }}
              >
                {grandTotal.toFixed(2)} MXN
              </span>
            </div>
          </div>
        </div>

        {/* 4. Professional Estimate Disclaimer & Notes */}
        <div
          className="print-avoid-break"
          style={{
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '11px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          <AlertCircle size={16} style={{ color: '#0d9488', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>{t('common.note', 'Note')}: </strong>
            {t(
              'patientTreatmentPlan.estimateDisclaimer',
              'This estimate is based on the odontogram solution chart. Final fees and procedures may vary after clinical evaluation. Estimate valid for 30 days.'
            )}
          </div>
        </div>

        {/* 5. Doctor & Patient Signatures Block */}
        <div
          className="print-avoid-break"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px',
            marginTop: '20px',
            paddingTop: '30px',
          }}
        >
          {/* Doctor Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '100%',
                maxWidth: '280px',
                borderBottom: '1px solid #334155',
                marginBottom: '8px',
              }}
            />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              {t('patientTreatmentPlan.doctorSignature', 'Doctor Signature & License')}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {clinicName || t('common.clinic', 'Dental Clinic')}
            </div>
          </div>

          {/* Patient Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '100%',
                maxWidth: '280px',
                borderBottom: '1px solid #334155',
                marginBottom: '8px',
              }}
            />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              {t('patientTreatmentPlan.patientSignature', 'Patient Acceptance')}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {patientFullName || t('patientTreatmentPlan.patient', 'Patient')}
            </div>
          </div>
        </div>

        {/* 6. Document Footer */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#94a3b8',
          }}
        >
          <span>Unified Dental Platform • {clinicName || 'Dental Clinic'}</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};
