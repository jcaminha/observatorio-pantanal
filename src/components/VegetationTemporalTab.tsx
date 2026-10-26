import React, { useState } from 'react';
import {
  Trees,
  Droplet,
  TrendingDown,
  TrendingUp,
  Info,
  Layers,
  BarChart3,
  Percent,
} from 'lucide-react';
import { MAPBIOMAS_TEMPORAL_DATA } from '../data/pantanalData.ts';
import { formatHectares } from '../utils/pantanalLogic.ts';

interface VegetationTemporalTabProps {
  isDarkMode: boolean;
}

type LandCoverKey =
  | 'waterSurfaceHa'
  | 'wetlandGrasslandHa'
  | 'forestHa'
  | 'savannaHa'
  | 'pastureHa'
  | 'otherHa';

interface CategoryConfig {
  key: LandCoverKey;
  label: string;
  color: string;
  hoverColor: string;
  desc: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'waterSurfaceHa',
    label: 'Superfície de Água',
    color: '#0284c7', // Sky 600
    hoverColor: '#38bdf8',
    desc: 'Rios, corixos, baías e lagoas',
  },
  {
    key: 'wetlandGrasslandHa',
    label: 'Campos Alagáveis & Várzeas',
    color: '#10b981', // Emerald 500
    hoverColor: '#34d399',
    desc: 'Campos úmidos sob pulso de inundação',
  },
  {
    key: 'forestHa',
    label: 'Formação Florestal',
    color: '#15803d', // Green 700
    hoverColor: '#22c55e',
    desc: 'Matas de galeria, capões e cordilheiras',
  },
  {
    key: 'savannaHa',
    label: 'Savana & Cerrado',
    color: '#84cc16', // Lime 500
    hoverColor: '#a3e635',
    desc: 'Savanas arbustivas e campos limpos nativos',
  },
  {
    key: 'pastureHa',
    label: 'Pastagem Cultivada',
    color: '#ea580c', // Orange 600
    hoverColor: '#fb923c',
    desc: 'Áreas convertidas para pecuária plantada',
  },
  {
    key: 'otherHa',
    label: 'Outros Usos / Mosaico',
    color: '#64748b', // Slate 500
    hoverColor: '#94a3b8',
    desc: 'Lavouras de grãos, infraestrutura e outros',
  },
];

export const VegetationTemporalTab: React.FC<VegetationTemporalTabProps> = ({
  isDarkMode,
}) => {
  const [viewMode, setViewMode] = useState<'hectares' | 'percent'>('hectares');
  const [hoveredSegment, setHoveredSegment] = useState<{
    year: number;
    catKey: LandCoverKey;
    ha: number;
    percent: number;
    totalHa: number;
  } | null>(null);

  const baselineData = MAPBIOMAS_TEMPORAL_DATA[0]; // 1985
  const latestData = MAPBIOMAS_TEMPORAL_DATA[MAPBIOMAS_TEMPORAL_DATA.length - 1]; // 2026

  // Key historical comparison metrics
  const waterLossPercent = Math.round(
    ((baselineData.waterSurfaceHa - latestData.waterSurfaceHa) / baselineData.waterSurfaceHa) * 100
  );
  const pastureExpansionPercent = Math.round(
    ((latestData.pastureHa - baselineData.pastureHa) / baselineData.pastureHa) * 100
  );

  // SVG Chart Dimensions - fills container height
  const width = 800;
  const height = 330;
  const padding = { top: 30, right: 35, bottom: 45, left: 75 };

  const totalYears = MAPBIOMAS_TEMPORAL_DATA.length;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const stepX = plotWidth / totalYears;
  const barWidth = Math.min(52, stepX * 0.68);

  // Maximum scale: in hectares mode, 20M ha; in percent mode, 100%
  const maxScaleHa = 20000000;

  // Pre-calculate totals per year
  const yearTotals = MAPBIOMAS_TEMPORAL_DATA.map((d) => {
    return (
      d.waterSurfaceHa +
      d.wetlandGrasslandHa +
      d.forestHa +
      d.savannaHa +
      d.pastureHa +
      d.otherHa
    );
  });

  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner */}
      <div className="shrink-0 mb-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#15347a] text-white shadow-xs">
                <Trees className="w-4 h-4" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Dinâmica de Cobertura da Terra & Retração de Superfície de Água
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-[#15347a] text-white shadow-2xs">
                MapBiomas Coleção 9
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Consolidação anual da transição ecológica e uso do solo no bioma Pantanal (1985–2026).
            </p>
          </div>

          {/* Mode Switcher (Hectares vs Percentual) & Official Source */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 p-1 rounded-lg border-2 ${
                isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
              }`}
            >
              <button
                onClick={() => setViewMode('hectares')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all border ${
                  viewMode === 'hectares'
                    ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                    : isDarkMode
                    ? 'text-slate-200 border-transparent hover:bg-blue-950'
                    : 'text-slate-800 border-slate-200 hover:bg-blue-50 hover:text-[#0a1c46]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Hectares (M ha)</span>
              </button>
              <button
                onClick={() => setViewMode('percent')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all border ${
                  viewMode === 'percent'
                    ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                    : isDarkMode
                    ? 'text-slate-200 border-transparent hover:bg-blue-950'
                    : 'text-slate-800 border-slate-200 hover:bg-blue-50 hover:text-[#0a1c46]'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentual (%)</span>
              </button>
            </div>

            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                isDarkMode
                  ? 'bg-[#101b38] border-blue-800 text-slate-100'
                  : 'bg-white border-blue-300 text-slate-900 shadow-xs'
              }`}
            >
              <span className="font-extrabold text-[#15347a] dark:text-blue-300">Fonte:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">MapBiomas</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-300">1985-2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stacked Bar Chart Quadro */}
      <div
        className={`p-4 rounded-xl border-2 flex-1 min-h-0 flex flex-col justify-between my-1 ${
          isDarkMode
            ? 'bg-[#0f172a] border-blue-900 text-slate-100'
            : 'bg-white border-slate-300 text-slate-900 shadow-sm'
        }`}
      >
        {/* Quadro Header: Legend & Hover Details */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          {/* Legend Items */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-black text-[#0a1c46] dark:text-blue-200 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Classes de Cobertura:
            </span>
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span
                  className="w-3 h-3 rounded-xs shrink-0 shadow-2xs"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-[11px] sm:text-xs">{cat.label}</span>
              </div>
            ))}
          </div>

          {/* Dynamic Inspector or 2026 Summary */}
          <div className="text-xs font-mono shrink-0">
            {hoveredSegment ? (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                <span className="font-black text-[#15347a] dark:text-blue-300">
                  {hoveredSegment.year}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {CATEGORIES.find((c) => c.key === hoveredSegment.catKey)?.label}:
                </span>
                <span className="font-black text-slate-900 dark:text-white">
                  {formatHectares(hoveredSegment.ha)} ({hoveredSegment.percent.toFixed(1)}%)
                </span>
              </div>
            ) : (
              <div className="text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                Passe o cursor sobre os segmentos empilhados para detalhes
              </div>
            )}
          </div>
        </div>

        {/* SVG Stacked Bar Canvas */}
        <div className="flex-1 min-h-0 relative w-full flex items-center justify-center py-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Horizontal Grid lines */}
            {viewMode === 'hectares' ? (
              // Hectares ticks: 0, 5M, 10M, 15M, 20M ha
              [0, 5000000, 10000000, 15000000, 20000000].map((haVal) => {
                const y = (height - padding.bottom) - (haVal / maxScaleHa) * plotHeight;
                return (
                  <g key={haVal}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill={isDarkMode ? '#cbd5e1' : '#1e293b'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {haVal === 0 ? '0' : `${haVal / 1000000} M ha`}
                    </text>
                  </g>
                );
              })
            ) : (
              // Percent ticks: 0%, 25%, 50%, 75%, 100%
              [0, 25, 50, 75, 100].map((pct) => {
                const y = (height - padding.bottom) - (pct / 100) * plotHeight;
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill={isDarkMode ? '#cbd5e1' : '#1e293b'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })
            )}

            {/* Stacked Bars per Year */}
            {MAPBIOMAS_TEMPORAL_DATA.map((item, yearIdx) => {
              const cx = padding.left + (yearIdx + 0.5) * stepX;
              const barX = cx - barWidth / 2;
              const totalHa = yearTotals[yearIdx];

              let currentCumulativeHa = 0;

              return (
                <g key={item.year} className="cursor-pointer">
                  {/* Category Segments stacked from bottom to top */}
                  {CATEGORIES.map((cat, catIdx) => {
                    const segHa = item[cat.key];
                    const bottomHa = currentCumulativeHa;
                    const topHa = currentCumulativeHa + segHa;
                    currentCumulativeHa = topHa;

                    let yTop: number;
                    let yBottom: number;

                    if (viewMode === 'hectares') {
                      yTop = (height - padding.bottom) - (topHa / maxScaleHa) * plotHeight;
                      yBottom = (height - padding.bottom) - (bottomHa / maxScaleHa) * plotHeight;
                    } else {
                      // Normalized 100%
                      yTop = (height - padding.bottom) - (topHa / totalHa) * plotHeight;
                      yBottom = (height - padding.bottom) - (bottomHa / totalHa) * plotHeight;
                    }

                    const segmentHeight = Math.max(1, yBottom - yTop);
                    const isHovered =
                      hoveredSegment?.year === item.year && hoveredSegment?.catKey === cat.key;
                    const isTopSegment = catIdx === CATEGORIES.length - 1;

                    return (
                      <rect
                        key={cat.key}
                        x={barX}
                        y={yTop}
                        width={barWidth}
                        height={segmentHeight}
                        rx={isTopSegment ? 4 : 0}
                        ry={isTopSegment ? 4 : 0}
                        fill={isHovered ? cat.hoverColor : cat.color}
                        stroke={isHovered ? (isDarkMode ? '#ffffff' : '#0a1c46') : isDarkMode ? '#0f172a' : '#ffffff'}
                        strokeWidth={isHovered ? 2 : 0.75}
                        className="transition-all duration-150"
                        onMouseEnter={() =>
                          setHoveredSegment({
                            year: item.year,
                            catKey: cat.key,
                            ha: segHa,
                            percent: (segHa / totalHa) * 100,
                            totalHa,
                          })
                        }
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                  })}

                  {/* Total Value text at top of each bar (only in hectares mode) */}
                  {viewMode === 'hectares' && (
                    <text
                      x={cx}
                      y={(height - padding.bottom) - (totalHa / maxScaleHa) * plotHeight - 8}
                      textAnchor="middle"
                      fill={isDarkMode ? '#cbd5e1' : '#0a1c46'}
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="900"
                    >
                      {(totalHa / 1000000).toFixed(1)}M
                    </text>
                  )}

                  {/* Year Label below Baseline */}
                  <text
                    x={cx}
                    y={height - padding.bottom + 22}
                    textAnchor="middle"
                    fill={isDarkMode ? '#e2e8f0' : '#0f172a'}
                    fontSize="12"
                    fontWeight="800"
                  >
                    {item.year}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 3 High-Contrast Comparison Cards: Key Ecological Transitions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 my-1">
        {/* Retração Hídrica */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between ${
            isDarkMode ? 'bg-red-950/30 border-red-800' : 'bg-red-50/90 border-red-300 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-600 text-white shrink-0 shadow-xs">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-black text-red-950 dark:text-red-100">
                Retração de Água: -{waterLossPercent}%
              </div>
              <div className="text-[11px] text-red-900 dark:text-red-200 font-semibold mt-0.5">
                De <strong>4,20 M ha</strong> (1985) para <strong>1,45 M ha</strong> (2026).
              </div>
            </div>
          </div>
          <Droplet className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        </div>

        {/* Expansão de Pastagens */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between ${
            isDarkMode ? 'bg-amber-950/30 border-amber-800' : 'bg-amber-50/90 border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-600 text-white shrink-0 shadow-xs">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-950 dark:text-amber-100">
                Pastagens Cultivadas: +{pastureExpansionPercent}%
              </div>
              <div className="text-[11px] text-amber-900 dark:text-amber-200 font-semibold mt-0.5">
                De <strong>450 mil ha</strong> para <strong>3,02 M ha</strong> plantados.
              </div>
            </div>
          </div>
          <span className="text-lg">🌱</span>
        </div>

        {/* Vegetação Nativa e Cobertura Florestal */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between ${
            isDarkMode ? 'bg-emerald-950/30 border-emerald-800' : 'bg-emerald-50/90 border-emerald-300 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-700 text-white shrink-0 shadow-xs">
              <Trees className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                Vegetação Nativa: 11,31 M ha
              </div>
              <div className="text-[11px] text-emerald-900 dark:text-emerald-200 font-semibold mt-0.5">
                Florestas (5,12 M ha) + Savanas (3,41 M ha) + Várzeas (2,78 M ha).
              </div>
            </div>
          </div>
          <Trees className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        </div>
      </div>

      {/* Attribution Footer */}
      <div
        className={`mt-1.5 px-4 py-1.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isDarkMode
            ? 'bg-[#101b38] border-blue-900 text-slate-200'
            : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#15347a] dark:text-blue-300 shrink-0" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Série temporal de cobertura e uso da terra produzida por inteligência artificial e satélites Landsat (resolução 30m).
          </span>
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
          Fonte: <strong>MapBiomas Pantanal (Coleção 9 / 2026)</strong>
        </div>
      </div>
    </div>
  );
};
