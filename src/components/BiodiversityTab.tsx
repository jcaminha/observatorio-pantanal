import React, { useState } from 'react';
import {
  Compass,
  Info,
} from 'lucide-react';
import { BIODIVERSITY_DATA } from '../data/pantanalData.ts';
import { BiodiversitySpecies } from '../types/pantanal.ts';

interface BiodiversityTabProps {
  isDarkMode: boolean;
  onSelectSpecies?: (species: BiodiversitySpecies) => void;
}

export const BiodiversityTab: React.FC<BiodiversityTabProps> = ({
  isDarkMode,
  onSelectSpecies,
}) => {
  const [selectedTaxa, setSelectedTaxa] = useState<string>('TODOS');
  const taxaList = ['TODOS', 'Mamífero', 'Ave', 'Réptil'];

  const filteredSpecies = BIODIVERSITY_DATA.filter((sp) => {
    if (selectedTaxa !== 'TODOS' && sp.taxa !== selectedTaxa) return false;
    return true;
  });

  return (
    <div className="h-full w-full flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Top Banner & Filter */}
      <div className="shrink-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-300 dark:border-blue-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#15347a] text-white shadow-xs">
                <Compass className="w-4 h-4" />
              </span>
              <h2
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                Biodiversidade, Espécies Bioindicadoras & Corredores Ecológicos
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              Monitoramento populacional da fauna pantaneira sob impacto de estiagem e conectividade de unidades de conservação.
            </p>
          </div>

          {/* Taxa Filter */}
          <div
            className={`flex items-center gap-1.5 p-1 rounded-lg border-2 ${
              isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
            }`}
          >
            {taxaList.map((taxa) => (
              <button
                key={taxa}
                onClick={() => setSelectedTaxa(taxa)}
                className={`px-3 py-1 rounded-md text-xs font-extrabold transition-all border ${
                  selectedTaxa === taxa
                    ? 'bg-[#15347a] text-white border-[#15347a] shadow-xs'
                    : isDarkMode
                    ? 'text-slate-200 border-transparent hover:bg-blue-950'
                    : 'text-slate-800 border-slate-200 hover:bg-blue-50 hover:text-[#0a1c46]'
                }`}
              >
                {taxa === 'TODOS' ? 'Todos os Grupos' : taxa}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: 6 Species Cards - High Contrast with Animal Photos */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSpecies.slice(0, 6).map((sp) => {
          return (
            <div
              key={sp.id}
              onClick={() => onSelectSpecies?.(sp)}
              className={`p-3 sm:p-3.5 rounded-xl border-2 flex flex-col justify-between transition-all cursor-pointer group hover:shadow-lg ${
                isDarkMode ? 'bg-[#0f172a] border-blue-900 hover:border-blue-600' : 'bg-white border-slate-300 hover:border-[#15347a] shadow-sm'
              }`}
            >
              <div>
                {/* Animal Photo with IUCN Badge */}
                <div className="relative w-full h-24 sm:h-28 mb-2 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                  <img
                    src={sp.photoUrl}
                    alt={sp.commonName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1.5 right-1.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded shadow-sm ${
                        sp.statusIUCN === 'Em Perigo'
                          ? 'bg-red-600 text-white'
                          : sp.statusIUCN === 'Vulnerável'
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {sp.statusIUCN}
                    </span>
                  </div>
                  <div className="absolute bottom-1.5 left-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-white backdrop-blur-xs">
                      {sp.taxa}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h3 className="font-black text-sm sm:text-base text-[#0a1c46] dark:text-blue-100 leading-tight truncate">
                      {sp.commonName}
                    </h3>
                    <div className="text-[11px] italic font-bold text-slate-700 dark:text-slate-300 truncate">
                      {sp.scientificName} · {sp.family}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug mt-1.5 mb-1">
                  {sp.description}
                </p>
              </div>

              <div className="space-y-1 text-[11px] pt-1.5 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-300">População Estimada:</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 truncate ml-1">{sp.estimatedPopulation}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Habitat:</span>
                  <span className="font-black text-[#15347a] dark:text-blue-300 truncate ml-1">{sp.habitat}</span>
                </div>
              </div>
            </div>
          );
        })}
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
            Monitoramento de fauna pelo INPP, ICMBio e IUCN Red List of Threatened Species.
          </span>
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
          Fonte: <strong>ICMBio / Livro Vermelho da Fauna Brasileira (2026)</strong>
        </div>
      </div>
    </div>
  );
};
