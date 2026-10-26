import React, { useState } from 'react';
import {
  Briefcase,
  TrendingUp,
  Leaf,
  Users,
  Award,
  Info,
  Globe,
  Percent,
} from 'lucide-react';
import { ECONOMIC_DATA } from '../data/pantanalData.ts';
import { formatPercentage } from '../utils/pantanalLogic.ts';

interface EconomyTabProps {
  isDarkMode: boolean;
}

export const EconomyTab: React.FC<EconomyTabProps> = ({ isDarkMode }) => {
  const [selectedSector, setSelectedSector] = useState<string>('TODOS');
  const sectors = ['TODOS', 'Pecuária', 'Agricultura', 'Turismo', 'Bioeconomia'];

  const filteredData = ECONOMIC_DATA.filter((item) =>
    selectedSector === 'TODOS' ? true : item.sector === selectedSector
  );

  return (
    <div className="h-full w-full flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden">
      {/* Top Banner & Sector Filter */}
      <div className="shrink-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b-2 border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-[#15347a] text-white shadow-xs">
                <Briefcase className="w-4 h-4" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Bioeconomia Regional & Cadeias Produtivas Sustentáveis
              </h2>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-[#15347a] dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                <Percent className="w-3 h-3" />
                Comparativo Nacional em %
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              Valores regionais do Pantanal e taxa percentual de participação frente aos totais e médias do Brasil.
            </p>
          </div>

          {/* Sector Filter Buttons */}
          <div
            className={`flex items-center gap-1 p-1 rounded-lg border-2 shrink-0 ${
              isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
            }`}
          >
            {sectors.map((sector) => (
              <button
                key={sector}
                onClick={() => setSelectedSector(sector)}
                className={`px-2.5 py-1 rounded-md text-xs font-black transition-all border ${
                  selectedSector === sector
                    ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                    : isDarkMode
                    ? 'text-slate-200 border-transparent hover:bg-blue-950'
                    : 'text-slate-800 border-slate-200 hover:bg-blue-50 hover:text-[#0a1c46]'
                }`}
              >
                {sector === 'TODOS' ? 'Todos os Setores' : sector}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
        {/* 4 High-level KPI Strip with National Percentage Comparison */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
          {/* KPI 1: Rebanho Pantaneiro */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-0.5">
                <span>Rebanho Pantaneiro</span>
                <Leaf className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-[#0a1c46] dark:text-blue-200">
                  4,2 Milhões
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">cabeças</span>
              </div>
            </div>

            {/* National Benchmark Pill & Progress */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#15347a] dark:text-blue-300" />
                  % do Total Brasil:
                </span>
                <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-blue-100 text-[#0a2560] dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                  1,8%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-[#15347a] dark:bg-blue-500 h-full rounded-full"
                  style={{ width: '1.8%' }}
                  title="1,8% do rebanho bovino nacional"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                Ref. Brasil: 234,4M cabeças (IBGE PPM)
              </p>
            </div>
          </div>

          {/* KPI 2: PIB do Ecoturismo */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-0.5">
                <span>PIB do Ecoturismo</span>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300">
                  R$ 440 Milhões
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">/ ano</span>
              </div>
            </div>

            {/* National Benchmark Pill & Progress */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  % do Ecoturismo Brasil:
                </span>
                <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                  5,0%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-emerald-700 dark:bg-emerald-400 h-full rounded-full"
                  style={{ width: '5.0%' }}
                  title="5,0% do PIB de ecoturismo do Brasil"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                Ref. Brasil: R$ 8,8 Bilhões em UCs (MTur)
              </p>
            </div>
          </div>

          {/* KPI 3: Carne Sustentável Certificada */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-0.5">
                <span>Carne Sustentável Certificada</span>
                <Award className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-800 dark:text-amber-300">
                  2,1 Milhões ha
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">auditados</span>
              </div>
            </div>

            {/* National Benchmark Pill & Progress */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  % Carne Sustentável Brasil:
                </span>
                <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  42,0%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-amber-600 dark:bg-amber-400 h-full rounded-full"
                  style={{ width: '42%' }}
                  title="42% da carne sustentável certificada do Brasil"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                Ref. Brasil: 440 mil animais/ano (ABPO/MAPA)
              </p>
            </div>
          </div>

          {/* KPI 4: Empregos Verdes Diretos */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-0.5">
                <span>Empregos Verdes Diretos</span>
                <Users className="w-4 h-4 text-[#15347a]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-[#0a2560] dark:text-blue-300">
                  18.500
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">postos de trabalho</span>
              </div>
            </div>

            {/* National Benchmark Pill & Progress */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#15347a] dark:text-blue-300" />
                  % Empregos UCs Brasil:
                </span>
                <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-blue-100 text-[#0a2560] dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                  8,6%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-[#15347a] dark:bg-blue-400 h-full rounded-full"
                  style={{ width: '8.6%' }}
                  title="8,6% dos empregos em UCs/conservação no Brasil"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                Ref. Brasil: 215 mil vagas em UCs (OIT/ICMBio)
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Indicators Grid with Prominent National Percentage Comparisons */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredData.slice(0, 6).map((item, idx) => {
            const pct = item.nationalPercent;
            // Visual width clamped between 3% (visible dot) and 100%
            const barWidth = Math.max(3, Math.min(pct, 100));

            return (
              <div
                key={idx}
                className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col justify-between ${
                  isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
                }`}
              >
                <div>
                  {/* Sector Tag & Trend */}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-black text-[#15347a] dark:text-blue-300 uppercase tracking-wider text-[11px]">
                      {item.sector}
                    </span>
                    <span className="font-mono text-emerald-800 dark:text-emerald-400 font-black text-xs">
                      {item.trend}
                    </span>
                  </div>

                  {/* Metric Name */}
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 leading-snug">
                    {item.metric}
                  </h4>

                  {/* Regional Pantanal Value */}
                  <div className="my-1 flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black font-mono text-[#0a2560] dark:text-blue-200">
                      {item.value}
                    </span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{item.unit}</span>
                  </div>

                  {/* High-Contrast National Percentage Comparison Box */}
                  <div
                    className={`p-2 rounded-lg border-2 my-1.5 ${
                      isDarkMode
                        ? 'bg-[#101b38] border-blue-800'
                        : 'bg-blue-50/90 border-blue-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-black text-[#0a1c46] dark:text-blue-200 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-[#15347a] dark:text-blue-300 shrink-0" />
                        Participação Nacional:
                      </span>
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-[#15347a] text-white dark:bg-blue-600 shadow-xs">
                        {formatPercentage(pct, 1)} do Brasil
                      </span>
                    </div>

                    {/* Progress Bar of National Share */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-gradient-to-r from-[#15347a] to-blue-500 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      <span className="font-black text-[#15347a] dark:text-blue-300">
                        {item.nationalBenchmarkLabel}
                      </span>
                      <div className="text-slate-600 dark:text-slate-400 font-semibold truncate mt-0.5">
                        {item.nationalContext}
                      </div>
                    </div>
                  </div>

                  {/* Qualitative Detail */}
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 mt-1">
                    {item.detail}
                  </p>
                </div>

                {/* Footer attribution */}
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="truncate">Fonte: <strong>{item.source}</strong></span>
                  <span className="shrink-0 ml-1">Ref: 2026</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribution Footer */}
      <div
        className={`mt-2 px-3.5 py-1.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isDarkMode
            ? 'bg-[#101b38] border-blue-900 text-slate-200'
            : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#15347a] dark:text-blue-300 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Valores percentuais calculados com base nos censos e pesquisas oficiais de referência nacional.
          </span>
        </div>
        <div className="text-xs font-black text-[#0a1c46] dark:text-blue-200">
          Fontes Oficiais: <strong>IBGE (PPM & Censo Agro), Conab, ABPO, MTur, ICMBio & MPA (2026)</strong>
        </div>
      </div>
    </div>
  );
};
