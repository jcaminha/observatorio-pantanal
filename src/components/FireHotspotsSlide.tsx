import React from 'react';
import {
  Flame,
  AlertTriangle,
  Zap,
  MapPin,
  Info,
} from 'lucide-react';
import { FIRE_SPOTS_DATA } from '../data/pantanalData.ts';
import { summarizeFireSpots } from '../utils/pantanalLogic.ts';
import { FireSpot } from '../types/pantanal.ts';

interface FireHotspotsSlideProps {
  isDarkMode: boolean;
  onSelectFire?: (fire: FireSpot) => void;
}

export const FireHotspotsSlide: React.FC<FireHotspotsSlideProps> = ({
  isDarkMode,
  onSelectFire,
}) => {
  const summary = summarizeFireSpots(FIRE_SPOTS_DATA);
  const criticalCount = FIRE_SPOTS_DATA.filter((f) => f.risk === 'Crítico').length;
  const msCount = FIRE_SPOTS_DATA.filter((f) => f.state === 'MS').length;
  const mtCount = FIRE_SPOTS_DATA.filter((f) => f.state === 'MT').length;

  // Group by subregion
  const subregionCounts: Record<string, number> = {};
  FIRE_SPOTS_DATA.forEach((f) => {
    subregionCounts[f.subRegion] = (subregionCounts[f.subRegion] || 0) + 1;
  });

  const sortedSubregions = Object.entries(subregionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner */}
      <div className="shrink-0 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-600 text-white shadow-xs">
                <Flame className="w-4 h-4 animate-pulse" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Monitoramento de Focos de Calor & Potência Radiativa (FRP)
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white shadow-2xs">
                Detecção por Satélite 24h
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Sensoriamento orbital de focos ativos, energia radiativa do fogo e distribuição no bioma Pantanal.
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
            <span className="text-slate-900 dark:text-slate-100">INPE BDQueimadas</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-300">24/10/2026 14:30</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: 4 High-level KPIs + 2 Column Analysis */}
      <div className="flex-1 min-h-0 flex flex-col justify-between gap-3">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              <span>Focos Ativos (24h)</span>
              <Flame className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-3xl font-black font-mono text-red-600 dark:text-red-400">
              {summary.totalSpots}
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Satélites Aqua/Terra & Suomi-NPP</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              <span>Focos em Risco Crítico</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
              {criticalCount}
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Potência Térmica Elevada (&gt;40 MW)</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              <span>FRP Médio (Potência)</span>
              <Zap className="w-4 h-4 text-[#15347a] dark:text-blue-400" />
            </div>
            <div className="text-3xl font-black font-mono text-[#0a2560] dark:text-blue-300">
              {summary.averageFrp.toFixed(1)} MW
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Taxa de consumo de biomassa</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              <span>Distribuição por Estado</span>
              <MapPin className="w-4 h-4 text-[#15347a]" />
            </div>
            <div className="flex items-baseline gap-2 text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
              <span>MS: <strong className="text-[#0a2560] dark:text-blue-300 font-black">{msCount}</strong></span>
              <span>·</span>
              <span>MT: <strong className="text-sky-700 dark:text-sky-400 font-black">{mtCount}</strong></span>
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">68% Pantanal Sul · 32% Pantanal Norte</div>
          </div>
        </div>

        {/* 2-Column Dense Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Subregions distribution */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-[#0a1c46] dark:text-blue-200">
                Incidência por Sub-Região do Pantanal
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total de 11 sub-regiões</span>
            </div>

            <div className="space-y-2.5 flex-1 flex flex-col justify-around">
              {sortedSubregions.slice(0, 5).map(([subregion, count]) => {
                const pct = Math.round((count / summary.totalSpots) * 100);
                return (
                  <div key={subregion} className="text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {subregion}
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                        {count} focos ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600">
                      <div
                        className="h-full bg-red-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Fire Spots Sample & Satellites */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-[#0a1c46] dark:text-blue-200">
                Focos Recentes com Alta Potência Radiativa
              </span>
              <span className="text-xs font-mono text-red-700 dark:text-red-400 font-extrabold">Críticos &gt; 40 MW</span>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-around">
              {FIRE_SPOTS_DATA.slice(0, 4).map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectFire?.(f)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                    isDarkMode
                      ? 'bg-blue-950/40 border-blue-800 hover:bg-blue-900/60'
                      : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping shrink-0" />
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        {f.municipality} ({f.state})
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Sub-região: <span className="font-bold text-slate-900 dark:text-slate-100">{f.subRegion}</span> · Satélite: {f.satellite}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-red-700 dark:text-red-400">
                      {f.frp} MW
                    </span>
                    <span className="text-[11px] font-bold block text-slate-700 dark:text-slate-300">{f.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Attribution Footer */}
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
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold">FRP (Fire Radiative Power)</strong>: Mede a taxa instantânea de liberação de energia radiativa do fogo pelo sensor orbital, proporcional à biomassa consumida e emissões de CO₂.
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span>
            Fonte: <strong className="text-slate-900 dark:text-slate-100 font-bold">INPE - Programa Queimadas</strong>
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
