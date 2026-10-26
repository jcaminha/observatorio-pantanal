import React from 'react';
import {
  Droplet,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
} from 'lucide-react';
import { RIVER_STATIONS_DATA } from '../data/pantanalData.ts';
import { RiverStation } from '../types/pantanal.ts';

interface HydrologySlideProps {
  isDarkMode: boolean;
  onSelectStation?: (station: RiverStation) => void;
}

export const HydrologySlide: React.FC<HydrologySlideProps> = ({
  isDarkMode,
  onSelectStation,
}) => {
  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner: Status da Bacia do Alto Paraguai (BAP) */}
      <div className="shrink-0 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#1e3a8a] text-white shadow-xs">
                <Droplet className="w-4 h-4" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Boletim Hidrológico & Monitoramento Fluviométrico dos Rios
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white shadow-2xs">
                Alerta de Estiagem Severa
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Rede Hidrometeorológica Nacional da Bacia do Alto Paraguai (BAP) · Região Hidrográfica do Paraguai.
            </p>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100'
                : 'bg-white border-blue-300 text-slate-900 shadow-xs'
            }`}
          >
            <span className="font-extrabold text-[#15347a] dark:text-blue-300">Fonte Oficial:</span>
            <span className="text-slate-900 dark:text-slate-100">ANA / SGB-CPRM</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-300">Hoje 09:00</span>
          </div>
        </div>
      </div>

      {/* Main Hydrological Grid: 6 Key Stations */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {RIVER_STATIONS_DATA.map((station) => {
          const isCritical = station.status === 'Emergência de Seca';
          const isWarning = station.status === 'Atenção';
          const isBelowZero = station.currentLevelCm < 0;

          return (
            <div
              key={station.id}
              onClick={() => onSelectStation?.(station)}
              className={`p-4 rounded-xl border-2 flex flex-col justify-between transition-all cursor-pointer hover:shadow-lg ${
                isCritical
                  ? isDarkMode
                    ? 'bg-red-950/25 border-red-700 hover:border-red-500'
                    : 'bg-white border-red-300 hover:border-red-500 shadow-sm'
                  : isDarkMode
                  ? 'bg-[#0f172a] border-blue-900 hover:border-blue-600'
                  : 'bg-white border-slate-300 hover:border-[#244b9b] shadow-sm'
              }`}
            >
              {/* Station Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight">
                      {station.name}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white dark:bg-slate-700">
                      {station.state}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    Rio: <span className="text-[#0a1c46] dark:text-blue-300 font-bold">{station.river}</span> ({station.municipality})
                  </div>
                </div>

                <span
                  className={`text-xs font-extrabold px-2.5 py-1 rounded-md shrink-0 shadow-xs ${
                    isCritical
                      ? 'bg-red-600 text-white'
                      : isWarning
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  {station.status}
                </span>
              </div>

              {/* Station Gauge Measurement Box - High Contrast */}
              <div
                className={`my-3 py-2.5 px-3.5 rounded-xl border flex items-center justify-between ${
                  isDarkMode
                    ? 'bg-[#101b38] border-blue-900'
                    : 'bg-blue-50/90 border-blue-200'
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Cota Fluviométrica Atual
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                        isBelowZero
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-[#0a2560] dark:text-blue-300'
                      }`}
                    >
                      {station.currentLevelCm > 0 ? `+${station.currentLevelCm}` : station.currentLevelCm}
                    </span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">cm</span>
                    {isBelowZero && (
                      <span className="text-xs text-red-700 dark:text-red-400 font-extrabold ml-1">
                        (abaixo do zero da régua)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Tendência
                  </div>
                  <div
                    className={`flex items-center gap-1 font-extrabold text-xs sm:text-sm justify-end mt-0.5 ${
                      station.trend === 'descendo'
                        ? 'text-red-700 dark:text-red-400'
                        : station.trend === 'subindo'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {station.trend === 'descendo' && <TrendingDown className="w-4 h-4 stroke-[2.5]" />}
                    {station.trend === 'subindo' && <TrendingUp className="w-4 h-4 stroke-[2.5]" />}
                    {station.trend === 'estável' && <Minus className="w-4 h-4 stroke-[2.5]" />}
                    <span className="capitalize">{station.trend}</span>
                  </div>
                </div>
              </div>

              {/* Reference Levels Comparison - Crisp Bold Text */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-bold">Média Histórica Esperada:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    +{station.normalLevelCm} cm
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-800 dark:text-red-400">Cota de Emergência (Seca):</span>
                  <span className="font-mono font-black text-red-700 dark:text-red-400 text-sm">
                    {station.criticalDroughtLevelCm} cm
                  </span>
                </div>
                {/* Visual Gauge Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-1 border border-slate-300 dark:border-slate-600">
                  <div
                    className={`h-full ${isCritical ? 'bg-red-600' : 'bg-[#15347a]'}`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          ((station.currentLevelCm - station.criticalDroughtLevelCm) /
                            (station.normalLevelCm - station.criticalDroughtLevelCm || 1)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Attribution & Scientific Context Footer */}
      <div
        className={`mt-3 px-4 py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
          isDarkMode
            ? 'bg-[#101b38] border-blue-900 text-slate-200'
            : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#15347a] dark:text-blue-400 shrink-0" />
          <span className="font-medium text-slate-800 dark:text-slate-200">
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold">Régua de Ladário (MS)</strong>: Histórico desde 1900. Níveis negativos impactam severamente a navegação comercial e elevam o risco de incêndios no Pantanal.
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span>
            Fonte: <strong className="text-slate-900 dark:text-slate-100 font-bold">Agência Nacional de Águas (ANA) & SGB-CPRM</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span>
            Data: <strong className="text-slate-900 dark:text-slate-100 font-bold">24/10/2026</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
