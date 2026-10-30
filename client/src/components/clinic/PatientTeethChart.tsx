import React, { useMemo } from 'react';
import { TeethModel } from '../../services/clinicOdontogramService';

export interface FindingItem {
  id?: string;
  toothNumber: number;
  surface: string; // WHOLE, OCCLUSAL, VESTIBULAR, LINGUAL, PALATAL, MESIAL, DISTAL, CERVICAL
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

  if (s === 'WHOLE') return 'Whole Tooth';
  if (s === 'OCCLUSAL') return 'Occlusal / Incisal';
  if (s === 'CERVICAL') return isUpper ? 'Upper Cervical / Apical' : 'Lower Cervical / Apical';
  if (s === 'VESTIBULAR') return isUpper ? 'Vestibular (Upper)' : 'Vestibular (Lower)';
  if (s === 'LINGUAL' || s === 'PALATAL') return isUpper ? 'Palatal (Lower)' : 'Lingual (Lower)';
  if (s === 'MESIAL') return 'Mesial';
  if (s === 'DISTAL') return 'Distal';
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
  // Map of toothNumber -> { surface -> FindingItem }
  const findingsMap = useMemo(() => {
    const map = new Map<number, {
      whole?: FindingItem;
      occlusal?: FindingItem;
      vestibular?: FindingItem;
      lingual?: FindingItem;
      mesial?: FindingItem;
      distal?: FindingItem;
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
      else if (s === 'CERVICAL') entry.cervical = f;
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

    const topFill = getFill(topSurfaceKey, isUpper ? entry.vestibular : entry.lingual);
    const bottomFill = getFill(bottomSurfaceKey, isUpper ? entry.lingual : entry.vestibular);
    const leftFill = getFill(leftSurfaceKey, isRightQuadrant ? entry.distal : entry.mesial);
    const rightFill = getFill(rightSurfaceKey, isRightQuadrant ? entry.mesial : entry.distal);
    const centerFill = getFill('OCCLUSAL', entry.occlusal);
    const cervicalFill = getFill('CERVICAL', entry.cervical);

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
          viewBox="0 0 44 52"
          width="42"
          height="50"
          style={{
            overflow: 'visible',
            filter: hasWhole ? `drop-shadow(0 0 3px ${wholeColor})` : 'none',
          }}
        >
          {/* Top Arc Sector */}
          <path
            d="M 9.98 9.98 A 17 17 0 0 1 34.02 9.98 L 27.3 16.7 A 7.5 7.5 0 0 0 16.7 16.7 Z"
            fill={topFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, topSurfaceKey);
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (${getSurfaceDisplayName(topSurfaceKey, toothNum)})`}</title>
          </path>

          {/* Bottom Arc Sector */}
          <path
            d="M 34.02 34.02 A 17 17 0 0 1 9.98 34.02 L 16.7 27.3 A 7.5 7.5 0 0 0 27.3 27.3 Z"
            fill={bottomFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, bottomSurfaceKey);
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (${getSurfaceDisplayName(bottomSurfaceKey, toothNum)})`}</title>
          </path>

          {/* Left Arc Sector */}
          <path
            d="M 9.98 34.02 A 17 17 0 0 1 9.98 9.98 L 16.7 16.7 A 7.5 7.5 0 0 0 16.7 27.3 Z"
            fill={leftFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, leftSurfaceKey);
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (${getSurfaceDisplayName(leftSurfaceKey, toothNum)})`}</title>
          </path>

          {/* Right Arc Sector */}
          <path
            d="M 34.02 9.98 A 17 17 0 0 1 34.02 34.02 L 27.3 27.3 A 7.5 7.5 0 0 0 27.3 16.7 Z"
            fill={rightFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, rightSurfaceKey);
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (${getSurfaceDisplayName(rightSurfaceKey, toothNum)})`}</title>
          </path>

          {/* Center Circle (Occlusal / Incisal) */}
          <circle
            cx="22"
            cy="22"
            r="7.2"
            fill={centerFill}
            stroke="#94a3b8"
            strokeWidth="1.1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'OCCLUSAL');
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (Occlusal / Incisal)`}</title>
          </circle>

          {/* Bottom Capsule Pill Bar (Cervical / Apical) */}
          <rect
            x="11"
            y="43"
            width="22"
            height="5.5"
            rx="2.75"
            fill={cervicalFill}
            stroke="#94a3b8"
            strokeWidth="1"
            className="tooth-surface-path"
            onClick={(e) => {
              e.stopPropagation();
              onSurfaceClick && onSurfaceClick(toothNum, 'CERVICAL');
            }}
            style={{
              transition: 'fill 0.15s ease, stroke 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <title>{`Tooth ${toothNum} (${getSurfaceDisplayName('CERVICAL', toothNum)})`}</title>
          </rect>
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
            height: '74px',
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
        WebkitOverflowScrolling: 'touch',
        padding: '16px 8px',
      }}
    >
      <div
        style={{
          minWidth: teethModel === 'CHILD' ? '540px' : '780px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          margin: '0 auto',
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
                Maxillary (Adult Permanent)
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
                Maxillary Deciduous (Child)
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
                Mandibular Deciduous (Child)
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
                Mandibular (Adult Permanent)
              </div>
              {renderArchRow(ADULT_LOWER_RIGHT, ADULT_LOWER_LEFT, false)}
            </div>
          </div>
        )}
      </div>

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
