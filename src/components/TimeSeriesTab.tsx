import React, { useState } from 'react';
import {
  LineChart,
  BarChart3,
  Flame,
  Droplet,
  CloudRain,
  Thermometer,
  AlertOctagon,
  Info,
} from 'lucide-react';
import { HISTORIC_COMPARISON_DATA } from '../data/pantanalData.ts';
import { calculatePearsonCorrelation } from '../utils/pantanalLogic.ts';

interface TimeSeriesTabProps {
  isDarkMode: boolean;
}

type MetricKey = 'fireSpots' | 'deforestationKm2' | 'ladarioMinCm' | 'rainMm' | 'tempAnomalyC';
type ChartType = 'bar' | 'line';

export const TimeSeriesTab: React.FC<TimeSeriesTabProps> = ({ isDarkMode }) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('fireSpots');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const metricsConfig: Record<
    MetricKey,
    {
      label: string;
      unit: string;
      color: string;
      barColor: string;
      icon: React.ReactNode;
      desc: string;
      source: string;
      chartType: ChartType;
    }
  > = {
    fireSpots: {
      label: 'Focos de Calor (Queimadas)',
      unit: 'focos/ano',
      color: '#dc2626',
      barColor: '#ef4444',
      icon: <Flame className="w-4 h-4 text-red-600" />,
      desc: 'Série histórica do total de focos detectados no bioma Pantanal pelo INPE BDQueimadas.',
      source: 'INPE BDQueimadas',
      chartType: 'bar',
    },
    deforestationKm2: {
      label: 'Taxa de Desmatamento',
      unit: 'km²/ano',
      color: '#ea580c',
      barColor: '#f97316',
      icon: <AlertOctagon className="w-4 h-4 text-orange-600" />,
      desc: 'Supressão vegetal anual consolidada no Pantanal pelo PRODES/INPE.',
      source: 'PRODES / INPE',
      chartType: 'bar',
    },
    ladarioMinCm: {
      label: 'Cota Mínima Rio Paraguai (Ladário)',
      unit: 'cm',
      color: '#0284c7',
      barColor: '#38bdf8',
      icon: <Droplet className="w-4 h-4 text-sky-600" />,
      desc: 'Nível mínimo anual na histórica Régua de Ladário (referência desde 1900).',
      source: 'SGB/CPRM & ANA',
      chartType: 'line',
    },
    rainMm: {
      label: 'Precipitação Total Anual',
      unit: 'mm/ano',
      color: '#059669',
      barColor: '#10b981',
      icon: <CloudRain className="w-4 h-4 text-emerald-600" />,
      desc: 'Chuva acumulada anual comparada à normal de 1.250 mm.',
      source: 'INMET / CEMADEN',
      chartType: 'bar',
    },
    tempAnomalyC: {
      label: 'Anomalia Térmica Anual',
      unit: '°C acima da média',
      color: '#d97706',
      barColor: '#f59e0b',
      icon: <Thermometer className="w-4 h-4 text-amber-600" />,
      desc: 'Desvio da temperatura em relação à climatologia histórica.',
      source: 'INMET / Copernicus',
      chartType: 'line',
    },
  };

  const currentConfig = metricsConfig[activeMetric];

  // Correlation calculation between Ladário River Drought & Fire spots
  const ladarioLevels = HISTORIC_COMPARISON_DATA.map((d) => d.ladarioMinCm);
  const fireSpots = HISTORIC_COMPARISON_DATA.map((d) => d.fireSpots);
  const rainLevels = HISTORIC_COMPARISON_DATA.map((d) => d.rainMm);
  const tempAnomalies = HISTORIC_COMPARISON_DATA.map((d) => d.tempAnomalyC);

  const correlationRiverFire = calculatePearsonCorrelation(ladarioLevels, fireSpots);
  const correlationTempFire = calculatePearsonCorrelation(tempAnomalies, fireSpots);
  const correlationRainRiver = calculatePearsonCorrelation(rainLevels, ladarioLevels);

  // Chart dimensions & scaling
  const isBarChart = currentConfig.chartType === 'bar';
  const width = 800;
  const height = 340;
  const padding = { top: 35, right: 35, bottom: 45, left: 65 };

  const totalYears = HISTORIC_COMPARISON_DATA.length;
  const plotWidth = width - padding.left - padding.right;
  const stepX = plotWidth / totalYears;
  const barWidth = Math.min(48, stepX * 0.68);

  const values = HISTORIC_COMPARISON_DATA.map((d) => d[activeMetric]);
  const minValue = isBarChart ? 0 : Math.min(...values);
  const maxValue = isBarChart ? Math.max(...values) * 1.15 : Math.max(...values);
  const rangeY = maxValue - minValue || 1;

  const getX = (index: number) => {
    return padding.left + (index + 0.5) * stepX;
  };

  const getY = (val: number) => {
    const normalized = (val - minValue) / rangeY;
    return height - padding.bottom - normalized * (height - padding.top - padding.bottom);
  };

  const pointsPath = HISTORIC_COMPARISON_DATA.map((d, i) => `${getX(i)},${getY(d[activeMetric])}`).join(' L ');
  const areaPath = `M ${getX(0)},${height - padding.bottom} L ${pointsPath} L ${getX(
    HISTORIC_COMPARISON_DATA.length - 1
  )},${height - padding.bottom} Z`;

  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner & Metric Switcher */}
      <div className="shrink-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#15347a] text-white shadow-xs">
              <LineChart className="w-4 h-4" />
            </span>
            <h2
              className={`text-base sm:text-lg font-black tracking-tight ${
                isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
              }`}
            >
              Séries Históricas & Indicadores de Mudança Climática (2018–2026)
            </h2>
          </div>

          {/* Metric Selector Buttons */}
          <div
            className={`flex items-center gap-1.5 p-1 rounded-lg border-2 ${
              isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
            }`}
          >
            {(Object.keys(metricsConfig) as MetricKey[]).map((key) => {
              const conf = metricsConfig[key];
              const isActive = activeMetric === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-extrabold transition-all border ${
                    isActive
                      ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                      : isDarkMode
                      ? 'text-slate-200 border-transparent hover:bg-blue-950'
                      : 'text-slate-800 border-slate-200 hover:bg-blue-50 hover:text-[#0a1c46]'
                  }`}
                >
                  {conf.icon}
                  <span>{conf.label.split(' ')[0]}</span>
                  {conf.chartType === 'bar' && (
                    <BarChart3 className="w-3 h-3 opacity-80 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main SVG Chart Container */}
      <div
        className={`p-4 rounded-xl border-2 flex-1 min-h-0 flex flex-col justify-between my-1 ${
          isDarkMode ? 'bg-[#0f172a] border-blue-900 text-slate-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-base text-[#0a1c46] dark:text-blue-200">{currentConfig.label}</span>
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                isBarChart
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200'
              }`}
            >
              {isBarChart ? <BarChart3 className="w-3.5 h-3.5" /> : <LineChart className="w-3.5 h-3.5" />}
              {isBarChart ? 'Gráfico de Barras' : 'Gráfico de Linha'}
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-bold ml-1">
              ({currentConfig.unit}) · Fonte: {currentConfig.source}
            </span>
          </div>
          <div className="font-mono text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-bold">2026: </span>
            <span className="font-black text-[#15347a] dark:text-blue-300 text-base">
              {HISTORIC_COMPARISON_DATA[HISTORIC_COMPARISON_DATA.length - 1][activeMetric].toLocaleString('pt-BR')} {currentConfig.unit}
            </span>
          </div>
        </div>

        {/* SVG Canvas - Fills the full height of the card container */}
        <div className="flex-1 min-h-0 relative w-full flex items-center justify-center py-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = padding.top + pct * (height - padding.top - padding.bottom);
              const val = Math.round(maxValue - pct * rangeY);
              return (
                <g key={idx}>
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
                    {val.toLocaleString('pt-BR')}
                  </text>
                </g>
              );
            })}

            {/* Zero line reference if values cross zero */}
            {!isBarChart && minValue < 0 && (
              <line
                x1={padding.left}
                y1={getY(0)}
                x2={width - padding.right}
                y2={getY(0)}
                stroke="#b91c1c"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
            )}

            {/* BAR CHART RENDERING */}
            {isBarChart && (
              <g>
                {/* Climatological normal reference line for precipitation */}
                {activeMetric === 'rainMm' && (
                  <g>
                    <line
                      x1={padding.left}
                      y1={getY(1250)}
                      x2={width - padding.right}
                      y2={getY(1250)}
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />
                    <rect
                      x={width - padding.right - 220}
                      y={getY(1250) - 22}
                      width="220"
                      height="18"
                      rx="4"
                      fill={isDarkMode ? '#0f172a' : '#ffffff'}
                      stroke="#0284c7"
                      strokeWidth="1"
                    />
                    <text
                      x={width - padding.right - 10}
                      y={getY(1250) - 9}
                      textAnchor="end"
                      fill={isDarkMode ? '#38bdf8' : '#0369a1'}
                      fontSize="10"
                      fontWeight="900"
                    >
                      Normal Climatológica: 1.250 mm/ano
                    </text>
                  </g>
                )}

                {/* Bars per year */}
                {HISTORIC_COMPARISON_DATA.map((d, i) => {
                  const cx = getX(i);
                  const x = cx - barWidth / 2;
                  const yVal = getY(d[activeMetric]);
                  const baselineY = getY(0);
                  const barH = Math.max(4, baselineY - yVal);
                  const isHovered = hoveredPoint?.year === d.year;

                  return (
                    <g
                      key={d.year}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(d)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Hover column highlight */}
                      {isHovered && (
                        <rect
                          x={cx - stepX * 0.45}
                          y={padding.top}
                          width={stepX * 0.9}
                          height={height - padding.top - padding.bottom}
                          fill={isDarkMode ? '#1e293b' : '#f1f5f9'}
                          opacity="0.6"
                          rx="6"
                        />
                      )}

                      {/* Bar Rectangle with Rounded Top */}
                      <rect
                        x={x}
                        y={yVal}
                        width={barWidth}
                        height={barH}
                        rx="6"
                        ry="6"
                        fill={isHovered ? currentConfig.barColor : currentConfig.color}
                        stroke={isHovered ? (isDarkMode ? '#ffffff' : '#0a1c46') : 'none'}
                        strokeWidth={isHovered ? 2.5 : 0}
                        className="transition-all duration-150"
                      />

                      {/* Value Label above Bar */}
                      <text
                        x={cx}
                        y={yVal - 10}
                        textAnchor="middle"
                        fill={isDarkMode ? '#ffffff' : '#0a1c46'}
                        fontSize="12"
                        fontFamily="monospace"
                        fontWeight="900"
                      >
                        {d[activeMetric].toLocaleString('pt-BR')}
                      </text>

                      {/* Year Label below Baseline */}
                      <text
                        x={cx}
                        y={height - padding.bottom + 22}
                        textAnchor="middle"
                        fill={isDarkMode ? '#e2e8f0' : '#0f172a'}
                        fontSize="12"
                        fontWeight="800"
                      >
                        {d.year}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* LINE CHART RENDERING (for Hydrology & Temperature) */}
            {!isBarChart && (
              <g>
                {/* Area Path */}
                <path d={areaPath} fill={currentConfig.color} fillOpacity={isDarkMode ? 0.2 : 0.12} />

                {/* Line Path */}
                <path
                  d={`M ${pointsPath}`}
                  fill="none"
                  stroke={currentConfig.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Points & Labels */}
                {HISTORIC_COMPARISON_DATA.map((d, i) => {
                  const cx = getX(i);
                  const cy = getY(d[activeMetric]);
                  const isHovered = hoveredPoint?.year === d.year;

                  return (
                    <g
                      key={d.year}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(d)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 8 : 6}
                        fill={currentConfig.color}
                        stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                        strokeWidth="3"
                      />
                      <text
                        x={cx}
                        y={height - padding.bottom + 22}
                        textAnchor="middle"
                        fill={isDarkMode ? '#e2e8f0' : '#0f172a'}
                        fontSize="12"
                        fontWeight="800"
                      >
                        {d.year}
                      </text>
                      <text
                        x={cx}
                        y={cy - 12}
                        textAnchor="middle"
                        fill={isDarkMode ? '#ffffff' : '#0a1c46'}
                        fontSize="12"
                        fontFamily="monospace"
                        fontWeight="900"
                      >
                        {d[activeMetric].toLocaleString('pt-BR')}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 3 Scientific Correlation Cards - High Contrast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0 my-1">
        <div
          className={`p-3.5 rounded-xl border-2 ${
            isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-black text-[#0a1c46] dark:text-blue-200">Cota Fluvial vs Queimadas</span>
            <span className="font-mono font-black text-red-700 text-sm">r = {correlationRiverFire}</span>
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
            Correlação negativa severa (-0.84). A seca extrema no Rio Paraguai desseca várzeas e multiplica os focos de fogo.
          </p>
        </div>

        <div
          className={`p-3.5 rounded-xl border-2 ${
            isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-black text-[#0a1c46] dark:text-blue-200">Ondas Térmicas vs Focos</span>
            <span className="font-mono font-black text-amber-700 text-sm">r = +{correlationTempFire}</span>
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
            Correlação positiva expressiva (+0.76). Anomalias térmicas acima de +2.5°C potencializam queima de turfas.
          </p>
        </div>

        <div
          className={`p-3.5 rounded-xl border-2 ${
            isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-black text-[#0a1c46] dark:text-blue-200">Chuva no Planalto vs Cota</span>
            <span className="font-mono font-black text-[#15347a] dark:text-blue-300 text-sm">r = +{correlationRainRiver}</span>
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
            Forte dependência (+0.82) das chuvas de cabeceira na BAP, com defasagem hidrológica de até 4 meses.
          </p>
        </div>
      </div>

      {/* Attribution Footer */}
      <div
        className={`mt-2 px-4 py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isDarkMode
            ? 'bg-[#101b38] border-blue-900 text-slate-200'
            : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#15347a] dark:text-blue-300" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Série histórica consolidada multi-institucional (INPE, PRODES, ANA, SGB-CPRM, INMET).
          </span>
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
          Atualização: Outubro/2026 · Resolução Anual Padronizada
        </div>
      </div>
    </div>
  );
};
