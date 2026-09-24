import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyTrendPoint } from '../../services/finance.service';
import { formatCurrency } from '../../core/utils/dateUtils';

interface Props {
  data: MonthlyTrendPoint[];
}

export const MonthlyTrendChart: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; month: string; quoted: number; collected: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 460;
  const height = 230;
  const padding = { top: 20, right: 20, bottom: 52, left: 70 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartH;

  const { maxVal, points, xLabels } = useMemo(() => {
    if (!data.length) return { maxVal: 0, points: [], xLabels: [] };
    const allVals = data.flatMap((d) => [d.quoted, d.collected]);
    const max = Math.max(...allVals, 1);
    const pts = data.map((d, i) => {
      const x = data.length === 1
        ? padding.left + chartW / 2
        : padding.left + (i * chartW) / (data.length - 1);
      return {
        x,
        yQ: padding.top + chartH - (d.quoted / max) * chartH,
        yC: padding.top + chartH - (d.collected / max) * chartH,
        ...d,
      };
    });
    const labels = data.map((d) => {
      const [y, m] = d.month.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    return { maxVal: max, points: pts, xLabels: labels };
  }, [data, chartW, chartH, padding.left, padding.top]);

  if (!data.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        {t('common.noData', 'No data available')}
      </div>
    );
  }

  // Paths
  const quotedPath = points.length === 1
    ? ''
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yQ}`).join(' ');

  const collectedPath = points.length === 1
    ? ''
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yC}`).join(' ');

  // Area under quoted
  const quotedArea = points.length > 1
    ? `${quotedPath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
    : '';

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = (maxVal / yTicks) * i;
    const y = baselineY - (val / maxVal) * chartH;
    return { val, y };
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = points[0];
    let minDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.x - mouseX);
      if (d < minDist) { minDist = d; closest = p; }
    }
    if (minDist < 45) {
      setTooltip({ x: closest.x, y: closest.yQ, month: closest.month, quoted: closest.quoted, collected: closest.collected });
    } else {
      setTooltip(null);
    }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Grid lines */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yl.y}
            x2={width - padding.right}
            y2={yl.y}
            stroke="var(--border-subtle, #e2e8f0)"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <text
            x={padding.left - 8}
            y={yl.y + 3.5}
            textAnchor="end"
            fontSize="8.5"
            fill="var(--text-muted)"
          >
            {formatCurrency(yl.val)}
          </text>
        </g>
      ))}

      {/* Single-point guide lines if only 1 point */}
      {points.length === 1 && (
        <>
          <line
            x1={points[0].x}
            y1={padding.top}
            x2={points[0].x}
            y2={baselineY}
            stroke="var(--border-subtle, #e2e8f0)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        </>
      )}

      {/* Area fill */}
      {quotedArea && <path d={quotedArea} fill="rgba(59, 130, 246, 0.08)" />}

      {/* Quoted line */}
      {quotedPath && <path d={quotedPath} fill="none" stroke="#3b82f6" strokeWidth={2} />}

      {/* Collected line */}
      {collectedPath && <path d={collectedPath} fill="none" stroke="#10b981" strokeWidth={2} />}

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.yQ} r={points.length === 1 ? 5 : 3.5} fill="#fff" stroke="#3b82f6" strokeWidth={2} />
          <circle cx={p.x} cy={p.yC} r={points.length === 1 ? 5 : 3.5} fill="#fff" stroke="#10b981" strokeWidth={2} />
        </g>
      ))}

      {/* X-axis labels (positioned cleanly above the legend band) */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={baselineY + 16}
          textAnchor="middle"
          fontSize="9"
          fontWeight={500}
          fill="var(--text-muted)"
        >
          {xLabels[i]}
        </text>
      ))}

      {/* Legend (cleanly separated at the bottom row with 24px vertical clearance) */}
      <g transform={`translate(${padding.left}, ${height - 12})`}>
        <rect x={0} y={-7} width={8} height={8} rx={2} fill="#3b82f6" />
        <text x={12} y={0} fontSize="8.5" fontWeight={500} fill="var(--text-muted)">
          {t('finance.overview.revenueQuoted')}
        </text>
        <rect x={155} y={-7} width={8} height={8} rx={2} fill="#10b981" />
        <text x={167} y={0} fontSize="8.5" fontWeight={500} fill="var(--text-muted)">
          {t('finance.overview.collectionsPaid')}
        </text>
      </g>

      {/* Tooltip */}
      {tooltip && (
        <g>
          <line
            x1={tooltip.x}
            y1={padding.top}
            x2={tooltip.x}
            y2={baselineY}
            stroke="#94a3b8"
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
          <rect
            x={Math.max(10, Math.min(width - 150, tooltip.x - 70))}
            y={Math.max(10, tooltip.y - 52)}
            width={140}
            height={44}
            rx={6}
            fill="var(--bg-card, #fff)"
            stroke="var(--border-color, #e2e8f0)"
            strokeWidth={1}
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
          />
          <text x={Math.max(18, Math.min(width - 142, tooltip.x - 62))} y={Math.max(26, tooltip.y - 36)} fontSize="9" fontWeight={700} fill="var(--text-heading)">
            {tooltip.month}
          </text>
          <text x={Math.max(18, Math.min(width - 142, tooltip.x - 62))} y={Math.max(38, tooltip.y - 24)} fontSize="8.5" fill="#3b82f6" fontWeight={600}>
            Quoted: {formatCurrency(tooltip.quoted)}
          </text>
          <text x={Math.max(18, Math.min(width - 142, tooltip.x - 62))} y={Math.max(50, tooltip.y - 12)} fontSize="8.5" fill="#10b981" fontWeight={600}>
            Collected: {formatCurrency(tooltip.collected)}
          </text>
        </g>
      )}
    </svg>
  );
};
