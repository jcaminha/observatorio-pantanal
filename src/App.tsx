/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { CarouselBar, SlideItem } from './components/CarouselBar.tsx';
import { SituationMapTab } from './components/SituationMapTab.tsx';
import { HydrologySlide } from './components/HydrologySlide.tsx';
import { FireHotspotsSlide } from './components/FireHotspotsSlide.tsx';
import { TimeSeriesTab } from './components/TimeSeriesTab.tsx';
import { VegetationTemporalTab } from './components/VegetationTemporalTab.tsx';
import { EconomyTab } from './components/EconomyTab.tsx';
import { BiodiversityTab } from './components/BiodiversityTab.tsx';
import { StationDetailModal } from './components/StationDetailModal.tsx';
import {
  Layers,
  Droplet,
  Flame,
  LineChart,
  Trees,
  Briefcase,
  Compass,
} from 'lucide-react';
import { HISTORIC_COMPARISON_DATA } from './data/pantanalData.ts';

// 20 segundos para cada dado conforme solicitado
const CAROUSEL_DURATION_SECONDS = 20;

export default function App() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true); // Auto-rotation active by default
  const [secondsRemaining, setSecondsRemaining] = useState<number>(CAROUSEL_DURATION_SECONDS);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false); // White background & blue accents (INPP design system)

  // Selected feature for detail inspection modal
  const [selectedFeature, setSelectedFeature] = useState<{
    data: any;
    type: 'fire' | 'river' | 'weather' | 'deforestation' | 'corridor' | 'species';
  } | null>(null);

  // 7 Defined Datum Slides for the Carousel
  const slides: SlideItem[] = [
    {
      id: 'situacao',
      title: 'Sala de Situação & Perímetro',
      badge: 'Mapa do Bioma',
      source: 'IBGE · INPE · ANA · INMET',
      date: '24/10/2026 14:30',
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      id: 'hidrologia',
      title: 'Boletim Hidrológico & Rios',
      badge: 'Cotas Fluviais',
      source: 'Agência Nacional de Águas & SGB-CPRM',
      date: 'Hoje 09:00',
      icon: <Droplet className="w-3.5 h-3.5" />,
    },
    {
      id: 'queimadas',
      title: 'Focos de Calor & FRP',
      badge: 'Queimadas 24h',
      source: 'INPE - BDQueimadas',
      date: '24/10/2026 14:30',
      icon: <Flame className="w-3.5 h-3.5" />,
    },
    {
      id: 'series',
      title: 'Séries Históricas & Clima',
      badge: '2018-2026',
      source: 'INPE · PRODES · SGB · INMET',
      date: 'Série 2018-2026',
      icon: <LineChart className="w-3.5 h-3.5" />,
    },
    {
      id: 'cobertura',
      title: 'Cobertura da Terra & Água',
      badge: 'MapBiomas',
      source: 'Rede MapBiomas Pantanal (Col. 9)',
      date: 'Base 1985-2026',
      icon: <Trees className="w-3.5 h-3.5" />,
    },
    {
      id: 'economia',
      title: 'Bioeconomia & Pecuária',
      badge: 'Economia BAP',
      source: 'Embrapa Pantanal · ABPO · IBGE',
      date: 'Ano Base 2026',
      icon: <Briefcase className="w-3.5 h-3.5" />,
    },
    {
      id: 'biodiversidade',
      title: 'Biodiversidade & Fauna',
      badge: 'Espécies & Corredores',
      source: 'ICMBio & IUCN Red List',
      date: 'Edição 2026',
      icon: <Compass className="w-3.5 h-3.5" />,
    },
  ];

  // 20-second automated carousel cycle
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Advance smoothly to next slide
          setCurrentSlideIndex((curr) => (curr + 1) % slides.length);
          return CAROUSEL_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, slides.length]);

  // Carousel Navigation Handlers
  const handleSelectSlide = useCallback((index: number) => {
    setCurrentSlideIndex(index);
    setSecondsRemaining(CAROUSEL_DURATION_SECONDS);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentSlideIndex((curr) => (curr - 1 + slides.length) % slides.length);
    setSecondsRemaining(CAROUSEL_DURATION_SECONDS);
  }, [slides.length]);

  const handleNext = useCallback(() => {
    setCurrentSlideIndex((curr) => (curr + 1) % slides.length);
    setSecondsRemaining(CAROUSEL_DURATION_SECONDS);
  }, [slides.length]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Keyboard navigation (arrows and spacebar for remote presentation/TV wallboards)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleTogglePlay]);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const handleSelectFeature = useCallback(
    (data: any, type: 'fire' | 'river' | 'weather' | 'deforestation' | 'corridor' | 'species') => {
      setSelectedFeature({ data, type });
      // Pause carousel while inspecting
      setIsPlaying(false);
    },
    []
  );

  const handleCloseModal = useCallback(() => {
    setSelectedFeature(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    let csv = 'Ano,Queimadas_Focos,Desmatamento_km2,Ladario_CotaMin_cm,Precipitacao_mm,Anomalia_Termica_C\n';
    HISTORIC_COMPARISON_DATA.forEach((row) => {
      csv += `${row.year},${row.fireSpots},${row.deforestationKm2},${row.ladarioMinCm},${row.rainMm},${row.tempAnomalyC}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `observatorio_pantanal_dados_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const activeSlideId = slides[currentSlideIndex]?.id || 'situacao';

  return (
    <div
      className={`h-screen max-h-screen w-screen overflow-hidden flex flex-col font-sans transition-colors duration-300 ${
        isDarkMode ? 'dark bg-[#090e1c] text-slate-100' : 'bg-[#f4f7fb] text-slate-900'
      }`}
    >
      {/* 1. Official Header (INPP Logo + Title + Clock + Actions) */}
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onExportData={handleExportCSV}
      />

      {/* 2. Carousel Control Bar (20s countdown ticker, controls, and datum badges) */}
      <CarouselBar
        slides={slides}
        currentIndex={currentSlideIndex}
        onSelectSlide={handleSelectSlide}
        onPrev={handlePrev}
        onNext={handleNext}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        secondsRemaining={secondsRemaining}
        totalDuration={CAROUSEL_DURATION_SECONDS}
        isDarkMode={isDarkMode}
      />

      {/* 3. Main Stage: 100% Viewport-Fitted Scroll-Free Datum View */}
      <main className="flex-1 min-h-0 w-full overflow-hidden relative">
        {activeSlideId === 'situacao' && (
          <SituationMapTab
            isDarkMode={isDarkMode}
            onSelectFeature={handleSelectFeature}
          />
        )}

        {activeSlideId === 'hidrologia' && (
          <HydrologySlide
            isDarkMode={isDarkMode}
            onSelectStation={(st) => handleSelectFeature(st, 'river')}
          />
        )}

        {activeSlideId === 'queimadas' && (
          <FireHotspotsSlide
            isDarkMode={isDarkMode}
            onSelectFire={(f) => handleSelectFeature(f, 'fire')}
          />
        )}

        {activeSlideId === 'series' && (
          <TimeSeriesTab isDarkMode={isDarkMode} />
        )}

        {activeSlideId === 'cobertura' && (
          <VegetationTemporalTab isDarkMode={isDarkMode} />
        )}

        {activeSlideId === 'economia' && (
          <EconomyTab isDarkMode={isDarkMode} />
        )}

        {activeSlideId === 'biodiversidade' && (
          <BiodiversityTab
            isDarkMode={isDarkMode}
            onSelectSpecies={(sp) => handleSelectFeature(sp, 'species')}
          />
        )}
      </main>

      {/* Floating Detail Inspection Modal */}
      {selectedFeature && (
        <StationDetailModal
          data={selectedFeature.data}
          type={selectedFeature.type}
          onClose={handleCloseModal}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
