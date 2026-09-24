import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PaymentDistribution } from '../../services/finance.service';

interface Props {
  data: PaymentDistribution;
}

export const PaymentStatusDonut: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 70;
  const innerR = 48;

  const total = data.totalOrders || 1;
  const paidAngle = (data.paidCount / total) * 360;
  const pendingAngle = (data.pendingCount / total) * 360;

  const polarToCartesian = (cxP: number, cyP: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cxP + r * Math.cos(rad), y: cyP + r * Math.sin(rad) };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 360) {
      // Full circle
      const half = (startAngle + endAngle) / 2;
      return describeArc(startAngle, half) + ' ' + describeArc(half, endAngle);
    }
    const start = polarToCartesian(cx, cy, outerR, endAngle);
    const end = polarToCartesian(cx, cy, outerR, startAngle);
    const startInner = polarToCartesian(cx, cy, innerR, endAngle);
    const endInner = polarToCartesian(cx, cy, innerR, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${start.x} ${start.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  // Colors
  const paidColor = '#10b981';
  const pendingColor = '#f59e0b';
  const bgRing = 'var(--bg-surface-muted, #f1f5f9)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {/* Donut */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke={bgRing} strokeWidth={outerR - innerR} />

          {/* Paid arc */}
          {data.paidCount > 0 && (
            <path
              d={describeArc(0, paidAngle)}
              fill={paidColor}
            />
          )}

          {/* Pending arc */}
          {data.pendingCount > 0 && (
            <path
              d={describeArc(paidAngle, paidAngle + pendingAngle)}
              fill={pendingColor}
            />
          )}

          {/* Outer ring border */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={pendingColor} strokeWidth={3} opacity={0.8} />
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)' }}>
            {data.totalOrders}
          </div>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('finance.overview.orders')}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: paidColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: paidColor }}>{t('finance.overview.paidWorkOrders')}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {data.paidCount} ({data.paidPercentage}%)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: pendingColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: pendingColor }}>{t('finance.overview.pendingPayment')}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {data.pendingCount} ({data.pendingPercentage}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
