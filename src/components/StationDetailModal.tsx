import React from 'react';
import { X, AlertTriangle, Droplet, Flame, Wind } from 'lucide-react';

interface StationDetailModalProps {
  data: any | null;
  type: 'fire' | 'river' | 'weather' | 'deforestation' | 'corridor' | 'species' | null;
  onClose: () => void;
  isDarkMode: boolean;
}

export const StationDetailModal: React.FC<StationDetailModalProps> = ({
  data,
  type,
  onClose,
  isDarkMode,
}) => {
  if (!data || !type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl border-2 shadow-2xl overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-[#0f172a] border-blue-900 text-slate-100'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between p-4 border-b-2 ${
          isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-blue-50 border-slate-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {type === 'fire' && <Flame className="w-5 h-5 text-red-600" />}
            {type === 'river' && <Droplet className="w-5 h-5 text-[#15347a]" />}
            {type === 'weather' && <Wind className="w-5 h-5 text-sky-600" />}
            {type === 'deforestation' && <AlertTriangle className="w-5 h-5 text-red-600" />}
            <div>
              <h3 className={`font-black text-base leading-tight ${
                isDarkMode ? 'text-slate-100' : 'text-[#0a1c46]'
              }`}>
                {type === 'fire' && `Foco de Calor #${data.id}`}
                {type === 'river' && data.name}
                {type === 'weather' && data.name}
                {type === 'deforestation' && `Alerta de Supressão #${data.id}`}
                {type === 'corridor' && data.name}
                {type === 'species' && data.commonName}
              </h3>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {data.municipality ? `${data.municipality} - ${data.state}` : 'Pantanal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes"
            className={`p-1.5 rounded-lg border-2 font-bold transition-colors ${
              isDarkMode
                ? 'border-blue-800 text-slate-300 hover:text-white hover:bg-blue-950'
                : 'border-slate-300 text-slate-900 hover:bg-blue-50'
            }`}
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
          {type === 'fire' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border-2 ${
                  isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-blue-50/80 border-blue-200'
                }`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Potência Radiativa (FRP)</span>
                  <span className="text-2xl font-black font-mono text-[#0a2560] dark:text-blue-300">{data.frp} MW</span>
                </div>
                <div className={`p-3 rounded-xl border-2 ${
                  isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-red-50/80 border-red-200'
                }`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Nível de Risco</span>
                  <span className="text-xl font-black text-red-700 dark:text-red-400">
                    {data.risk}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <div>Sub-região: <span className="font-bold text-slate-900 dark:text-slate-100">{data.subRegion}</span></div>
                <div>Satélite Detector: <span className="font-bold text-slate-900 dark:text-slate-100">{data.satellite}</span></div>
                <div>Confiabilidade: <span className="font-bold text-slate-900 dark:text-slate-100">{data.confidence}%</span></div>
                <div>Coordenadas: <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{data.lat.toFixed(4)}, {data.lng.toFixed(4)}</span></div>
                <div>Data/Hora Detecção: <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(data.timestamp).toLocaleString('pt-BR')}</span></div>
              </div>
            </div>
          )}

          {type === 'river' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border-2 ${
                  isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-blue-50/80 border-blue-200'
                }`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Cota Atual</span>
                  <span className={`text-2xl font-black font-mono ${data.currentLevelCm <= 0 ? 'text-red-700 dark:text-red-400' : 'text-[#0a2560] dark:text-blue-300'}`}>
                    {data.currentLevelCm} cm
                  </span>
                </div>
                <div className={`p-3 rounded-xl border-2 ${
                  isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-slate-50 border-slate-300'
                }`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Status Operacional</span>
                  <span className="text-base font-black text-red-700 dark:text-red-400">{data.status}</span>
                </div>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <div>Rio Principal: <span className="font-bold text-slate-900 dark:text-slate-100">{data.river}</span></div>
                <div>Média Climatológica: <span className="font-bold text-slate-900 dark:text-slate-100">+{data.normalLevelCm} cm</span></div>
                <div>Cota de Alerta de Cheia: <span className="font-bold text-slate-900 dark:text-slate-100">+{data.alertFloodLevelCm} cm</span></div>
                <div>Cota Crítica de Seca: <span className="text-red-700 dark:text-red-400 font-bold">{data.criticalDroughtLevelCm} cm</span></div>
                <div>Tendência do Rio: <span className="font-black text-slate-900 dark:text-slate-100 uppercase">{data.trend}</span></div>
                <div>Última Leitura: <span className="font-bold text-slate-900 dark:text-slate-100">{data.lastUpdated}</span></div>
              </div>
            </div>
          )}

          {type === 'species' && (
            <div className="space-y-3">
              {data.photoUrl && (
                <div className="w-full h-44 rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700">
                  <img
                    src={data.photoUrl}
                    alt={data.commonName}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('public/')) {
                        target.src = data.photoUrl.startsWith('/') ? data.photoUrl : `/${data.photoUrl}`;
                      }
                    }}
                  />
                </div>
              )}
              <div className="space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <div>Nome Científico: <span className="italic font-bold text-slate-900 dark:text-slate-100">{data.scientificName}</span></div>
                <div>Família: <span className="font-bold text-slate-900 dark:text-slate-100">{data.family}</span></div>
                <div>Status IUCN: <span className="font-black text-red-700 dark:text-red-400">{data.statusIUCN}</span></div>
                <div>População Estimada: <span className="font-bold text-slate-900 dark:text-slate-100">{data.estimatedPopulation}</span></div>
                <div>Habitat Primário: <span className="font-bold text-slate-900 dark:text-slate-100">{data.habitat}</span></div>
                <div className="mt-2 text-slate-900 dark:text-slate-100 font-medium leading-relaxed">{data.description}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
