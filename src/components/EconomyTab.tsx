import React, { useState } from 'react';
import {
  Briefcase,
  TrendingUp,
  Leaf,
  Users,
  Award,
  Info,
} from 'lucide-react';
import { ECONOMIC_DATA } from '../data/pantanalData.ts';

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
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner & Sector Filter */}
      <div className="shrink-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#15347a] text-white shadow-xs">
                <Briefcase className="w-4 h-4" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Bioeconomia Regional & Cadeias Produtivas Sustentáveis
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Pecuária tradicional em pastagens nativas, ecoturismo de observação de fauna e bioeconomia pantaneira.
            </p>
          </div>

          {/* Sector Filter Buttons */}
          <div
            className={`flex items-center gap-1.5 p-1 rounded-lg border-2 ${
              isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
            }`}
          >
            {sectors.map((sector) => (
              <button
                key={sector}
                onClick={() => setSelectedSector(sector)}
                className={`px-3 py-1 rounded-md text-xs font-extrabold transition-all border ${
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
      <div className="flex-1 min-h-0 flex flex-col justify-between gap-3">
        {/* 4 High-level KPI Strip - High Contrast */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
              <span>Rebanho Pantaneiro</span>
              <Leaf className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#0a1c46] dark:text-blue-200">
              4,2 Milhões
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">Cabeças de gado em pastagem nativa</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
              <span>PIB do Ecoturismo</span>
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              R$ 440 Milhões
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">Observação de onças & pesca esportiva</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
              <span>Carne Sustentável Certificada</span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-700 dark:text-amber-400">
              2,1 Milhões ha
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">Certificação ABPO / Protocolo Pantaneiro</div>
          </div>

          <div
            className={`p-3.5 rounded-xl border-2 ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
              <span>Empregos Verdes Diretos</span>
              <Users className="w-4 h-4 text-[#15347a]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#0a2560] dark:text-blue-300">
              18.500
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">Guias, barqueiros, vaqueiros e brigadistas</div>
          </div>
        </div>

        {/* Detailed Indicators Grid - High Contrast */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredData.slice(0, 6).map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border-2 flex flex-col justify-between ${
                isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-extrabold text-[#15347a] dark:text-blue-300 uppercase tracking-wider">
                    {item.sector}
                  </span>
                  <span className="font-mono text-emerald-700 font-extrabold">{item.trend}</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 leading-snug">
                  {item.metric}
                </h4>
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-[#0a2560] dark:text-blue-200">
                    {item.value}
                  </span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{item.unit}</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  {item.detail}
                </p>
              </div>

              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                <span>Fonte: {item.source}</span>
                <span>Ref: 2026</span>
              </div>
            </div>
          ))}
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
            Indicadores de bioeconomia, serviços ecossistêmicos e valorização dos saberes tradicionais pantaneiros.
          </span>
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
          Fonte: <strong>Embrapa Pantanal, ABPO e IBGE PPM (2026)</strong>
        </div>
      </div>
    </div>
  );
};
