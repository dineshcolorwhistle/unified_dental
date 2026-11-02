import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { TeethModel } from '../../services/clinicOdontogramService';

export interface FindingItem {
  id?: string;
  toothNumber: number;
  surface: string; // WHOLE, OCCLUSAL, VESTIBULAR, LINGUAL, PALATAL, MESIAL, DISTAL, UPPER_CERVICAL, LOWER_CERVICAL
  name?: string;
  diagnosticName?: string;
  treatmentName?: string;
  color: string;
  notes?: string | null;
  diagnosticId?: string | null;
  treatmentId?: string | null;
}

export interface PatientTeethChartProps {
  teethModel: TeethModel;
  findings: FindingItem[];
  selectedTooth: number | null;
  selectedSurface: string | null;
  onToothClick?: (toothNumber: number) => void;
  onSurfaceClick?: (toothNumber: number, surface: string) => void;
}

// Adult Teeth FDI Numbers
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

// Pediatric Teeth FDI Numbers
const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];
const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];

export const getSurfaceDisplayName = (surface: string, toothNumber: number): string => {
  const s = surface.toUpperCase();
  const isUpper = (toothNumber >= 11 && toothNumber <= 28) || (toothNumber >= 51 && toothNumber <= 65);

  if (s === 'WHOLE') return i18n.t('patientOdontogram.surfaces.wholeTooth', 'Whole Tooth');
  if (s === 'OCCLUSAL') return i18n.t('patientOdontogram.surfaces.occlusal', 'Occlusal / Incisal');
  if (s === 'UPPER_CERVICAL') return i18n.t('patientOdontogram.surfaces.upperCervical', 'Upper Cervical / Apical');
  if (s === 'LOWER_CERVICAL') return i18n.t('patientOdontogram.surfaces.lowerCervical', 'Lower Cervical / Apical');
  if (s === 'CERVICAL') {
    return isUpper
      ? i18n.t('patientOdontogram.surfaces.upperCervical', 'Upper Cervical / Apical')
      : i18n.t('patientOdontogram.surfaces.lowerCervical', 'Lower Cervical / Apical');
  }
  if (s === 'VESTIBULAR') {
    return isUpper
      ? i18n.t('patientOdontogram.surfaces.vestibularUpper', 'Vestibular (Upper)')
      : i18n.t('patientOdontogram.surfaces.vestibularLower', 'Vestibular (Lower)');
  }
  if (s === 'LINGUAL' || s === 'PALATAL') {
    return isUpper
      ? i18n.t('patientOdontogram.surfaces.palatalLower', 'Palatal (Upper)')
      : i18n.t('patientOdontogram.surfaces.lingualLower', 'Lingual (Lower)');
  }
  if (s === 'MESIAL') return i18n.t('patientOdontogram.surfaces.mesial', 'Mesial');
  if (s === 'DISTAL') return i18n.t('patientOdontogram.surfaces.distal', 'Distal');
  return surface;
};

export type ToothZone = 'POSTERIOR' | 'ANTERIOR';
export type ToothQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export const getToothZoneAndQuadrant = (
  toothNumber: number,
): { zone: ToothZone; quadrant: ToothQuadrant } => {
  let quadrant: ToothQuadrant = 'Q1';
  const lastDigit = toothNumber % 10;

  if ((toothNumber >= 11 && toothNumber <= 18) || (toothNumber >= 51 && toothNumber <= 55)) {
    quadrant = 'Q1';
  } else if ((toothNumber >= 21 && toothNumber <= 28) || (toothNumber >= 61 && toothNumber <= 65)) {
    quadrant = 'Q2';
  } else if ((toothNumber >= 31 && toothNumber <= 38) || (toothNumber >= 71 && toothNumber <= 75)) {
    quadrant = 'Q3';
  } else if ((toothNumber >= 41 && toothNumber <= 48) || (toothNumber >= 81 && toothNumber <= 85)) {
    quadrant = 'Q4';
  }

  // Anterior teeth: Central Incisor (1), Lateral Incisor (2), Canine (3)
  // Posterior teeth: 1st Premolar (4), 2nd Premolar (5), 1st Molar (6), 2nd Molar (7), 3rd Molar (8)
  const isAnterior = lastDigit >= 1 && lastDigit <= 3;
  const zone: ToothZone = isAnterior ? 'ANTERIOR' : 'POSTERIOR';

  return { zone, quadrant };
};

export const PatientTeethChart: React.FC<PatientTeethChartProps> = ({
  teethModel,
  findings,
  selectedTooth,
  selectedSurface,
  onToothClick,
  onSurfaceClick,
}) => {
  const { t } = useTranslation();

  // Floating tooltip state matching sidebar style
  const [hoverInfo, setHoverInfo] = useState<{
    toothNum: number;
    surface: string;
    x: number;
    y: number;
    finding?: FindingItem;
  } | null>(null);

  const handleMouseEnter = (
    e: React.MouseEvent<SVGElement>,
    toothNum: number,
    surface: string,
    finding?: FindingItem,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverInfo({
      toothNum,
      surface,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      finding,
    });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  // Map of toothNumber -> { surface -> FindingItem }
  const findingsMap = useMemo(() => {
    const map = new Map<number, {
      whole?: FindingItem;
      occlusal?: FindingItem;
      vestibular?: FindingItem;
      lingual?: FindingItem;
      mesial?: FindingItem;
      distal?: FindingItem;
      upperCervical?: FindingItem;
      lowerCervical?: FindingItem;
      cervical?: FindingItem;
    }>();

    findings.forEach((f) => {
      if (!map.has(f.toothNumber)) {
        map.set(f.toothNumber, {});
      }
      const entry = map.get(f.toothNumber)!;
      const s = f.surface.toUpperCase();

      if (s === 'WHOLE') entry.whole = f;
      else if (s === 'OCCLUSAL') entry.occlusal = f;
      else if (s === 'VESTIBULAR') entry.vestibular = f;
      else if (s === 'LINGUAL' || s === 'PALATAL') entry.lingual = f;
      else if (s === 'MESIAL') entry.mesial = f;
      else if (s === 'DISTAL') entry.distal = f;
      else if (s === 'UPPER_CERVICAL') entry.upperCervical = f;
      else if (s === 'LOWER_CERVICAL') entry.lowerCervical = f;
      else if (s === 'CERVICAL') {
        entry.upperCervical = f;
      }
    });

    return map;
  }, [findings]);

  // Render an individual tooth block
  const renderToothBlock = (toothNum: number, isUpper: boolean, isRightQuadrant: boolean) => {
    const entry = findingsMap.get(toothNum) || {};
    const hasWhole = !!entry.whole;
    const wholeColor = entry.whole?.color;

    // Surface orientations:
    // Upper: Top is Vestibular, Bottom is Lingual/Palatal
    // Lower: Top is Lingual, Bottom is Vestibular
    const topSurfaceKey = isUpper ? 'VESTIBULAR' : 'LINGUAL';
    const bottomSurfaceKey = isUpper ? 'LINGUAL' : 'VESTIBULAR';

    // Right quadrants (1, 4, 5, 8): Right arc is Mesial (towards midline), Left is Distal
    // Left quadrants (2, 3, 6, 7): Left arc is Mesial (towards midline), Right is Distal
    const leftSurfaceKey = isRightQuadrant ? 'DISTAL' : 'MESIAL';
    const rightSurfaceKey = isRightQuadrant ? 'MESIAL' : 'DISTAL';

    // Helper to get surface fill color
    const getFill = (surfKey: string, specificFinding?: FindingItem) => {
      if (specificFinding) return specificFinding.color;
      if (hasWhole && wholeColor) return wholeColor;
      return '#ffffff';
    };

    const topSpecificFinding = isUpper ? entry.vestibular : entry.lingual;
    const bottomSpecificFinding = isUpper ? entry.lingual : entry.vestibular;
    const leftSpecificFinding = isRightQuadrant ? entry.distal : entry.mesial;
    const rightSpecificFinding = isRightQuadrant ? entry.mesial : entry.distal;
    const upperCervicalFinding = entry.upperCervical || (entry.cervical && isUpper ? entry.cervical : undefined);
    const lowerCervicalFinding = entry.lowerCervical || (entry.cervical && !isUpper ? entry.cervical : undefined);

    const topFill = getFill(topSurfaceKey, topSpecificFinding);
    const bottomFill = getFill(bottomSurfaceKey, bottomSpecificFinding);
    const leftFill = getFill(leftSurfaceKey, leftSpecificFinding);
    const rightFill = getFill(rightSurfaceKey, rightSpecificFinding);
    const centerFill = getFill('OCCLUSAL', entry.occlusal);
    const upperCervicalFill = getFill('UPPER_CERVICAL', upperCervicalFinding);
    const lowerCervicalFill = getFill('LOWER_CERVICAL', lowerCervicalFinding);

    const isToothSelected = selectedTooth === toothNum;

    return (
      <div
        key={toothNum}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 3px',
          cursor: 'pointer',
        }}
        onClick={() => onToothClick && onToothClick(toothNum)}
      >
        {/* Tooth Number */}
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: isToothSelected ? '#0284c7' : '#334155',
            letterSpacing: '0.02em',
            padding: '2px 4px',
            borderRadius: '4px',
            backgroundColor: isToothSelected ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
            userSelect: 'none',
          }}
        >
          {toothNum}
        </div>

        {/* Concentric Circular Tooth SVG */}
        <svg
          viewBox="0 0 44 60"
          width="44"
          height="60"
          style={{
            overflow: 'visible',
            filter: hasWhole ? `drop-shadow(0 0 3px ${wholeColor})` : 'none',
          }}
        >
          {/* Top Outer Curved Arc (Upper Cervical / Apical) */}
          <path
            d="M 5.91 13.50 A 21 21 0 0 1 38.09 13.50 L 34.64 16.39 A 16.5 16.5 0 0 0 9.36 16.39 Z"
            fill={upperCervicalFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'UPPER_CERVICAL');
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, 'UPPER_CERVICAL', upperCervicalFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Top Arc Sector */}
          <path
            d="M 11.39 16.39 A 15 15 0 0 1 32.61 16.39 L 26.60 22.40 A 6.5 6.5 0 0 0 17.40 22.40 Z"
            fill={topFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, topSurfaceKey);
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, topSurfaceKey, topSpecificFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Bottom Arc Sector */}
          <path
            d="M 32.61 37.61 A 15 15 0 0 1 11.39 37.61 L 17.40 31.60 A 6.5 6.5 0 0 0 26.60 31.60 Z"
            fill={bottomFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, bottomSurfaceKey);
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, bottomSurfaceKey, bottomSpecificFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Left Arc Sector */}
          <path
            d="M 11.39 37.61 A 15 15 0 0 1 11.39 16.39 L 17.40 22.40 A 6.5 6.5 0 0 0 17.40 31.60 Z"
            fill={leftFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, leftSurfaceKey);
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, leftSurfaceKey, leftSpecificFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Right Arc Sector */}
          <path
            d="M 32.61 16.39 A 15 15 0 0 1 32.61 37.61 L 26.60 31.60 A 6.5 6.5 0 0 0 26.60 22.40 Z"
            fill={rightFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, rightSurfaceKey);
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, rightSurfaceKey, rightSpecificFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Center Circle (Occlusal / Incisal) */}
          <circle
            cx="22"
            cy="27"
            r="6.5"
            fill={centerFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'OCCLUSAL');
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, 'OCCLUSAL', entry.occlusal || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Bottom Outer Curved Arc (Lower Cervical / Apical) */}
          <path
            d="M 38.09 40.50 A 21 21 0 0 1 5.91 40.50 L 9.36 37.61 A 16.5 16.5 0 0 0 34.64 37.61 Z"
            fill={lowerCervicalFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'LOWER_CERVICAL');
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, 'LOWER_CERVICAL', lowerCervicalFinding || entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />

          {/* Bottom Capsule Pill Bar (Whole Tooth) */}
          <rect
            x="11"
            y="52"
            width="22"
            height="5"
            rx="2.5"
            fill={hasWhole && wholeColor ? wholeColor : '#ffffff'}
            stroke="#94a3b8"
            strokeWidth="1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'WHOLE');
            }}
            onMouseEnter={(e) => handleMouseEnter(e, toothNum, 'WHOLE', entry.whole)}
            onMouseLeave={handleMouseLeave}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          />
        </svg>
      </div>
    );
  };

  // Render an arch row (Right Quadrant + Midline + Left Quadrant)
  const renderArchRow = (
    rightQuadrant: number[],
    leftQuadrant: number[],
    isUpper: boolean,
  ) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
        }}
      >
        {/* Right Quadrant (Patient's Right / Viewer's Left) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '2px',
          }}
        >
          {rightQuadrant.map((tn) => renderToothBlock(tn, isUpper, true))}
        </div>

        {/* Vertical Midline Divider */}
        <div
          style={{
            width: '1px',
            height: '90px',
            backgroundColor: '#cbd5e1',
            margin: '0 4px',
          }}
        />

        {/* Left Quadrant (Patient's Left / Viewer's Right) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '2px',
          }}
        >
          {leftQuadrant.map((tn) => renderToothBlock(tn, isUpper, false))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'visible',
        WebkitOverflowScrolling: 'touch',
        padding: '24px 12px 32px',
      }}
    >
      <div
        style={{
          minWidth: teethModel === 'CHILD' ? '540px' : '780px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          margin: '0 auto',
          padding: '8px 0',
        }}
      >
        {/* Adult Model (32 Teeth) */}
        {teethModel === 'ADULT' && (
          <>
            {/* Upper Arch */}
            {renderArchRow(ADULT_UPPER_RIGHT, ADULT_UPPER_LEFT, true)}

            {/* Horizontal Jaw Divider */}
            <div
              style={{
                width: '92%',
                maxWidth: '740px',
                height: '1px',
                backgroundColor: '#cbd5e1',
                margin: '2px 0',
              }}
            />

            {/* Lower Arch */}
            {renderArchRow(ADULT_LOWER_RIGHT, ADULT_LOWER_LEFT, false)}
          </>
        )}

        {/* Child Model (20 Teeth) */}
        {teethModel === 'CHILD' && (
          <>
            {/* Upper Pediatric Arch */}
            {renderArchRow(CHILD_UPPER_RIGHT, CHILD_UPPER_LEFT, true)}

            {/* Horizontal Jaw Divider */}
            <div
              style={{
                width: '80%',
                maxWidth: '500px',
                height: '1px',
                backgroundColor: '#cbd5e1',
                margin: '2px 0',
              }}
            />

            {/* Lower Pediatric Arch */}
            {renderArchRow(CHILD_LOWER_RIGHT, CHILD_LOWER_LEFT, false)}
          </>
        )}

        {/* Complete Model (52 Teeth: Adult + Child Mixed Dentition) */}
        {teethModel === 'COMPLETE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            {/* Upper Adult Arch */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  textAlign: 'center',
                  marginBottom: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {t('patientOdontogram.arches.maxillaryAdult', 'Maxillary (Adult Permanent)')}
              </div>
              {renderArchRow(ADULT_UPPER_RIGHT, ADULT_UPPER_LEFT, true)}
            </div>

            {/* Upper Pediatric Arch */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  textAlign: 'center',
                  marginBottom: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {t('patientOdontogram.arches.maxillaryChild', 'Maxillary Deciduous (Child)')}
              </div>
              {renderArchRow(CHILD_UPPER_RIGHT, CHILD_UPPER_LEFT, true)}
            </div>

            {/* Horizontal Divider */}
            <div
              style={{
                width: '92%',
                maxWidth: '740px',
                height: '1px',
                backgroundColor: '#cbd5e1',
                margin: '4px auto',
              }}
            />

            {/* Lower Pediatric Arch */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  textAlign: 'center',
                  marginBottom: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {t('patientOdontogram.arches.mandibularChild', 'Mandibular Deciduous (Child)')}
              </div>
              {renderArchRow(CHILD_LOWER_RIGHT, CHILD_LOWER_LEFT, false)}
            </div>

            {/* Lower Adult Arch */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  textAlign: 'center',
                  marginBottom: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                {t('patientOdontogram.arches.mandibularAdult', 'Mandibular (Adult Permanent)')}
              </div>
              {renderArchRow(ADULT_LOWER_RIGHT, ADULT_LOWER_LEFT, false)}
            </div>
          </div>
        )}
      </div>

      {/* Floating Tooltip Portal matching attached image design */}
      {hoverInfo &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${hoverInfo.x}px`,
              top: `${hoverInfo.y}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              padding: '7px 12px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.5), 0 4px 10px -2px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              zIndex: 999999,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            {/* Top row: Tooth {N} */}
            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px', letterSpacing: '-0.01em' }}>
              {t('patientOdontogram.toothLabel', 'Tooth')} {hoverInfo.toothNum}
            </div>

            {/* Subtitle: Surface Name in Cyan */}
            <div style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 600 }}>
              {getSurfaceDisplayName(hoverInfo.surface, hoverInfo.toothNum)}
            </div>

            {/* Condition / Treatment applied badge if any */}
            {hoverInfo.finding && (
              <div
                style={{
                  marginTop: '3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: hoverInfo.finding.color,
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  alignSelf: 'flex-start',
                }}
              >
                {hoverInfo.finding.diagnosticName ||
                  hoverInfo.finding.treatmentName ||
                  hoverInfo.finding.name}
              </div>
            )}

            {/* Downward pointing triangle arrow */}
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: '#0f172a',
                borderRight: '1px solid rgba(255, 255, 255, 0.16)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            />
          </div>,
          document.body,
        )}

      <style>{`
        .tooth-surface-path:hover {
          stroke: #0284c7 !important;
          stroke-width: 1.5 !important;
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
};
