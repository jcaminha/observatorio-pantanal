import React, { useState, useEffect } from 'react';
import {
  Trees,
  Droplet,
  Play,
  Pause,
  RotateCcw,
  TrendingDown,
  Info,
} from 'lucide-react';
import { MAPBIOMAS_TEMPORAL_DATA } from '../data/pantanalData.ts';
import { formatHectares } from '../utils/pantanalLogic.ts';

interface VegetationTemporalTabProps {
  isDarkMode: boolean;
}

export const VegetationTemporalTab: React.FC<VegetationTemporalTabProps> = ({
  isDarkMode,
}) => {
  const years = MAPBIOMAS_TEMPORAL_DATA.map((d) => d.year);
  const [selectedYearIndex, setSelectedYearIndex] = useState<number>(years.length - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [compareYearIndex] = useState<number>(0); // 1985 as baseline

  const currentYearData = MAPBIOMAS_TEMPORAL_DATA[selectedYearIndex];
  const baselineData = MAPBIOMAS_TEMPORAL_DATA[compareYearIndex];

  // Auto-play timelapse
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setSelectedYearIndex((prev) => (prev + 1) % years.length);
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, years.length]);

  // Percentage change in water surface compared to 1985 baseline
  const waterLossHectares = baselineData.waterSurfaceHa - currentYearData.waterSurfaceHa;
  const waterLossPercent = Math.round(
    ((baselineData.waterSurfaceHa - currentYearData.waterSurfaceHa) / baselineData.waterSurfaceHa) * 100
  );

  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner */}
      <div className="shrink-0 mb-2">
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
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#15347a] text-white shadow-2xs">
                MapBiomas Coleção 9
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Análise histórica multitemporal (1985–2026) da retração de corpos hídricos e transição de uso da terra.
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
            <span className="text-slate-900 dark:text-slate-100">Rede MapBiomas Pantanal</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-300">Base 1985-2026</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col justify-between gap-3">
        {/* Retraction Alert Banner - High Contrast */}
        <div
          className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDarkMode
              ? 'bg-red-950/40 border-red-700 text-red-100'
              : 'bg-red-50 border-red-300 text-red-950 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shrink-0 shadow-xs">
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base text-red-950 dark:text-red-100">
                Retração Histórica de -{waterLossPercent}% da Superfície de Água ({currentYearData.year} vs 1985)
              </div>
              <div className="text-xs text-red-900 dark:text-red-200 mt-0.5 font-bold">
                Perda líquida de mais de <strong>{formatHectares(waterLossHectares)}</strong> em relação ao ápice de cheias históricas do bioma.
              </div>
            </div>
          </div>

          {/* Interactive Timelapse Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-[#15347a] text-white hover:bg-[#0a1c46] transition-all shadow-xs"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 stroke-[2.5]" /> : <Play className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{isPlaying ? 'Pausar Animação' : 'Animar 1985-2026'}</span>
            </button>
            <button
              onClick={() => setSelectedYearIndex(0)}
              title="Voltar para 1985"
              className="p-1.5 rounded-lg border-2 border-slate-300 dark:border-blue-800 bg-white dark:bg-[#101b38] text-slate-900 dark:text-slate-100 hover:bg-slate-50 font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Land Cover Classes KPI Grid - High Contrast */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Água */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                <span>Superfície de Água</span>
                <Droplet className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black font-mono text-sky-700 dark:text-sky-400">
                {formatHectares(currentYearData.waterSurfaceHa)}
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <span>Cobertura:</span>
              <span className="font-black text-sky-700 dark:text-sky-400">{currentYearData.waterCoverPercentage}% do bioma</span>
            </div>
          </div>

          {/* Pastagens Cultivadas */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                <span>Pastagens Cultivadas</span>
                <span className="text-sm">🌱</span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
                {formatHectares(currentYearData.pastureHa)}
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <span>Crescimento pós-1985:</span>
              <span className="font-black text-amber-700 dark:text-amber-400">+380%</span>
            </div>
          </div>

          {/* Formação Savânica */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                <span>Savana & Cerrado</span>
                <Trees className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                {formatHectares(currentYearData.savannaHa)}
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <span>Vigor Vegetativo (NDVI):</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400">{currentYearData.ndviAverage.toFixed(2)}</span>
            </div>
          </div>

          {/* Formação Florestal */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                <span>Formação Florestal</span>
                <span className="text-sm">🌳</span>
              </div>
              <div className="text-2xl font-black font-mono text-[#0a2560] dark:text-blue-300">
                {formatHectares(currentYearData.forestHa)}
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <span>Matas de Galeria:</span>
              <span className="font-black text-[#15347a] dark:text-blue-300">Estável</span>
            </div>
          </div>
        </div>

        {/* Horizontal Year Timeline Slider - High Contrast */}
        <div
          className={`p-3.5 rounded-xl border-2 ${
            isDarkMode ? 'bg-[#0f172a] border-blue-900' : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-black text-sm text-[#0a1c46] dark:text-blue-200">
              Linha do Tempo da Transição Ecológica ({currentYearData.year})
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
              Passo {selectedYearIndex + 1} de {years.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {MAPBIOMAS_TEMPORAL_DATA.map((item, idx) => {
              const isSelected = idx === selectedYearIndex;
              return (
                <button
                  key={item.year}
                  onClick={() => setSelectedYearIndex(idx)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black font-mono transition-all border ${
                    isSelected
                      ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                      : isDarkMode
                      ? 'bg-blue-950/60 text-slate-200 border-blue-900 hover:text-white'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-blue-50 hover:text-[#0a1c46] font-bold'
                  }`}
                >
                  {item.year}
                </button>
              );
            })}
          </div>
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
            Mapeamento anual da cobertura e uso da terra do Brasil com classificação automatizada de imagens de satélite.
          </span>
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
          Fonte: <strong>MapBiomas Coleção 9 (1985-2026)</strong>
        </div>
      </div>
    </div>
  );
};
