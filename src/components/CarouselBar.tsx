import React from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface SlideItem {
  id: string;
  title: string;
  badge: string;
  source: string;
  date: string;
  icon: React.ReactNode;
}

interface CarouselBarProps {
  slides: SlideItem[];
  currentIndex: number;
  onSelectSlide: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  secondsRemaining: number;
  totalDuration: number;
  isDarkMode: boolean;
}

export const CarouselBar: React.FC<CarouselBarProps> = ({
  slides,
  currentIndex,
  onSelectSlide,
  onPrev,
  onNext,
  isPlaying,
  onTogglePlay,
  secondsRemaining,
  totalDuration,
  isDarkMode,
}) => {
  const currentSlide = slides[currentIndex] || slides[0];
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalDuration - secondsRemaining) / totalDuration) * 100)
  );

  return (
    <div
      className={`relative z-20 border-b select-none transition-colors ${
        isDarkMode
          ? 'bg-[#0b1329] border-blue-950 text-slate-100'
          : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
      }`}
    >
      {/* 20-second dynamic progress countdown bar */}
      <div
        className={`w-full h-1.5 overflow-hidden ${
          isDarkMode ? 'bg-blue-950' : 'bg-blue-100'
        }`}
      >
        <div
          className={`h-full transition-all duration-300 ease-linear ${
            isPlaying ? 'bg-[#15347a]' : 'bg-amber-600'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Playback Controls & Counter */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Previous Button */}
          <button
            onClick={onPrev}
            aria-label="Slide anterior"
            title="Slide anterior (Seta Esquerda)"
            className={`p-1.5 rounded-lg border-2 font-bold transition-all ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100 hover:bg-blue-900'
                : 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 shadow-2xs'
            }`}
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pausar carrossel' : 'Iniciar carrossel'}
            title={isPlaying ? 'Pausar rotação de 20s (Barra de Espaço)' : 'Iniciar rotação (Barra de Espaço)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs transition-all shadow-xs ${
              isPlaying
                ? 'bg-[#15347a] text-white hover:bg-[#0a2560]'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Iniciar</span>
              </>
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            aria-label="Próximo slide"
            title="Próximo slide (Seta Direita)"
            className={`p-1.5 rounded-lg border-2 font-bold transition-all ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100 hover:bg-blue-900'
                : 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 shadow-2xs'
            }`}
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Slide index & timer badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border-2 ${
              isDarkMode
                ? 'bg-[#101b38] border-blue-800 text-slate-100'
                : 'bg-blue-50 border-blue-300 text-slate-900 shadow-2xs'
            }`}
          >
            <span className="font-extrabold text-slate-900 dark:text-slate-100">
              Dado {currentIndex + 1} de {slides.length}
            </span>
            <span className="text-slate-400">·</span>
            <span
              className={`font-black ${
                secondsRemaining <= 5 && isPlaying
                  ? 'text-red-700 animate-pulse'
                  : 'text-[#15347a] dark:text-blue-300'
              }`}
            >
              {secondsRemaining}s / {totalDuration}s
            </span>
          </div>
        </div>

        {/* Slide Selection Pills - High Contrast */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
          {slides.map((s, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSlide(idx)}
                aria-label={`Ir para ${s.title}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 border ${
                  isActive
                    ? 'bg-[#15347a] text-white border-[#15347a] font-extrabold shadow-sm'
                    : isDarkMode
                    ? 'bg-[#101b38] text-slate-200 border-blue-900 hover:bg-blue-900/60 font-bold'
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-blue-50 hover:text-[#0a1c46] hover:border-blue-400 font-bold'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-[#15347a] dark:text-blue-300'}>
                  {s.icon}
                </span>
                <span className="hidden xl:inline">{s.title}</span>
                <span className="xl:hidden">{s.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Current Datum Provenance and Timestamp - High Contrast */}
        <div className="hidden lg:flex items-center gap-2 text-right shrink-0">
          <div className="text-xs leading-tight">
            <div className="font-black text-slate-900 dark:text-slate-100">
              {currentSlide.source}
            </div>
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              Ref: <span className="font-mono">{currentSlide.date}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
