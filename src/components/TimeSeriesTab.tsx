import React, { useState } from 'react';
import {
  LineChart,
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

export const TimeSeriesTab: React.FC<TimeSeriesTabProps> = ({ isDarkMode }) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('fireSpots');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const metricsConfig: Record<
    MetricKey,
    { label: string; unit: string; color: string; icon: React.ReactNode; desc: string; source: string }
  > = {
    fireSpots: {
      label: 'Focos de Calor (Queimadas)',
      unit: 'focos/ano',
      color: '#dc2626',
      icon: <Flame className="w-4 h-4 text-red-600" />,
      desc: 'Série histórica do total de focos detectados no bioma Pantanal pelo INPE BDQueimadas.',
      source: 'INPE BDQueimadas',
    },
    deforestationKm2: {
      label: 'Taxa de Desmatamento',
      unit: 'km²/ano',
      color: '#ea580c',
      icon: <AlertOctagon className="w-4 h-4 text-orange-600" />,
      desc: 'Supressão vegetal anual consolidada no Pantanal pelo PRODES/INPE.',
      source: 'PRODES / INPE',
    },
    ladarioMinCm: {
      label: 'Cota Mínima Rio Paraguai (Ladário)',
      unit: 'cm',
      color: '#0284c7',
      icon: <Droplet className="w-4 h-4 text-sky-600" />,
      desc: 'Nível mínimo anual na histórica Régua de Ladário (referência desde 1900).',
      source: 'SGB/CPRM & ANA',
    },
    rainMm: {
      label: 'Precipitação Total Anual',
      unit: 'mm/ano',
      color: '#059669',
      icon: <CloudRain className="w-4 h-4 text-emerald-600" />,
      desc: 'Chuva acumulada anual comparada à normal de 1.250 mm.',
      source: 'INMET / CEMADEN',
    },
    tempAnomalyC: {
      label: 'Anomalia Térmica Anual',
      unit: '°C acima da média',
      color: '#d97706',
      icon: <Thermometer className="w-4 h-4 text-amber-600" />,
      desc: 'Desvio da temperatura em relação à climatologia histórica.',
      source: 'INMET / Copernicus',
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

  // SVG Chart Dimensions
  const width = 800;
  const height = 210;
  const padding = { top: 20, right: 30, bottom: 35, left: 60 };

  const values = HISTORIC_COMPARISON_DATA.map((d) => d[activeMetric]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rangeY = maxValue - minValue || 1;

  const getX = (index: number) => {
    return (
      padding.left +
      (index / (HISTORIC_COMPARISON_DATA.length - 1)) *
        (width - padding.left - padding.right)
    );
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
          <div>
            <span className="font-black text-base text-[#0a1c46] dark:text-blue-200">{currentConfig.label}</span>
            <span className="text-slate-700 dark:text-slate-300 font-bold ml-2">({currentConfig.unit}) · Fonte: {currentConfig.source}</span>
          </div>
          <div className="font-mono text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-bold">2026: </span>
            <span className="font-black text-[#15347a] dark:text-blue-300 text-base">
              {HISTORIC_COMPARISON_DATA[HISTORIC_COMPARISON_DATA.length - 1][activeMetric].toLocaleString('pt-BR')} {currentConfig.unit}
            </span>
          </div>
        </div>

        {/* SVG Canvas */}
        <div className="flex-1 min-h-0 relative w-full flex items-center justify-center">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full max-h-[190px]"
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
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill={isDarkMode ? '#cbd5e1' : '#1e293b'}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {val.toLocaleString('pt-BR')}
                  </text>
                </g>
              );
            })}

            {/* Zero line reference if values cross zero */}
            {minValue < 0 && (
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

            {/* Area Path */}
            <path d={areaPath} fill={currentConfig.color} fillOpacity={isDarkMode ? 0.2 : 0.12} />

            {/* Line Path */}
            <path
              d={`M ${pointsPath}`}
              fill="none"
              stroke={currentConfig.color}
              strokeWidth="3.5"
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
                    r={isHovered ? 7 : 5}
                    fill={currentConfig.color}
                    stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                    strokeWidth="2.5"
                  />
                  <text
                    x={cx}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    fill={isDarkMode ? '#e2e8f0' : '#0f172a'}
                    fontSize="11"
                    fontWeight="800"
                  >
                    {d.year}
                  </text>
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    fill={isDarkMode ? '#ffffff' : '#0a1c46'}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="900"
                  >
                    {d[activeMetric].toLocaleString('pt-BR')}
                  </text>
                </g>
              );
            })}
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
