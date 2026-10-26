import React, { useEffect, useState } from 'react';
import {
  Clock,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Download,
} from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onExportData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onExportData,
}) => {
  const [timePantanal, setTimePantanal] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Pantanal is UTC-4 (Mato Grosso / Mato Grosso do Sul)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Campo_Grande',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const formatted = new Intl.DateTimeFormat('pt-BR', options).format(now);
      setTimePantanal(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  return (
    <header
      className={`border-b-2 shrink-0 transition-colors relative z-30 ${
        isDarkMode
          ? 'bg-[#0b1329] border-blue-950 text-slate-100'
          : 'bg-white border-slate-300 text-slate-900 shadow-xs'
      }`}
    >
      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* INPP Brand & Logo Lockup */}
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded-xl border-2 flex items-center justify-center shrink-0 ${
              isDarkMode
                ? 'bg-white border-blue-900 shadow-sm'
                : 'bg-white border-slate-300 shadow-2xs'
            }`}
          >
            <img
              src="/assets/aistudio/inpp-logo_474abc68.png"
              alt="INPP - Instituto Nacional de Pesquisa do Pantanal"
              className="h-9 sm:h-11 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className={`text-base sm:text-lg font-black tracking-tight leading-tight ${
                  isDarkMode ? 'text-blue-100' : 'text-[#0a1c46]'
                }`}
              >
                OBSERVATÓRIO DO PANTANAL
              </h1>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  isDarkMode
                    ? 'bg-blue-900 text-blue-200 border border-blue-700'
                    : 'bg-[#15347a] text-white'
                }`}
              >
                INPP · MCTI
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate mt-0.5">
              <span className="text-slate-900 dark:text-slate-100">
                Instituto Nacional de Pesquisa do Pantanal
              </span>
              <span aria-hidden="true" className="text-slate-400 hidden sm:inline">·</span>
              <span className="text-slate-700 dark:text-slate-300 hidden sm:inline font-semibold">Sala de Situação & Monitoramento Contínuo</span>
            </p>
          </div>
        </div>

        {/* Right Controls: Clock, Fullscreen, CSV, Theme */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Official Pantanal Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border-2 ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-blue-200'
                : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
            }`}
            title="Horário Oficial do Pantanal (MS/MT - UTC-4)"
          >
            <Clock className="w-4 h-4 text-[#15347a] dark:text-blue-400 stroke-[2.5]" />
            <span className="font-black text-sm">{timePantanal || '12:00:00'}</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-sans font-bold hidden sm:inline">MS/MT</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            aria-label="Alternar Tela Cheia"
            title="Tela Cheia (ideal para televisores e telões)"
            className={`p-2 rounded-lg border-2 transition-colors ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100 hover:bg-blue-950'
                : 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 shadow-2xs font-bold'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Dark / Light Mode Switch */}
          <button
            onClick={onToggleDarkMode}
            aria-label="Alternar Modo Escuro / Claro"
            title={isDarkMode ? 'Modo Claro (Fundo Branco & Azul)' : 'Modo Escuro (Salas de Monitoramento)'}
            className={`p-2 rounded-lg border-2 transition-colors ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-amber-300 hover:bg-blue-950'
                : 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 shadow-2xs font-bold'
            }`}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Export CSV Data Button */}
          <button
            onClick={onExportData}
            aria-label="Exportar dados consolidados em CSV"
            title="Exportar dados consolidados em CSV"
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-colors ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100 hover:bg-blue-950'
                : 'bg-white border-slate-300 text-[#0a1c46] hover:bg-blue-50 shadow-2xs'
            }`}
          >
            <Download className="w-4 h-4 text-[#15347a] dark:text-blue-400 stroke-[2.5]" />
            <span>CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
