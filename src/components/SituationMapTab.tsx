import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Flame,
  Droplet,
  Wind,
  AlertTriangle,
  Compass,
  Filter,
  Eye,
  Map as MapIcon,
  Layers,
  ChevronDown,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  FIRE_SPOTS_DATA,
  RIVER_STATIONS_DATA,
  WEATHER_STATIONS_DATA,
  DEFORESTATION_DATA,
  CORRIDORS_DATA,
  BIODIVERSITY_DATA,
  PANTANAL_BOUNDS,
  PANTANAL_BIOME_PERIMETER,
  PANTANAL_PERIMETER_METADATA,
} from '../data/pantanalData.ts';
import {
  SubRegion,
  StateCode,
  FireSpot,
  RiverStation,
  WeatherStation,
  DeforestationAlert,
  EcologicalCorridor,
  BiodiversitySpecies,
} from '../types/pantanal.ts';
import { filterFireSpots, summarizeFireSpots } from '../utils/pantanalLogic.ts';

interface SituationMapTabProps {
  isDarkMode: boolean;
  onSelectFeature: (
    data: any,
    type: 'fire' | 'river' | 'weather' | 'deforestation' | 'corridor' | 'species'
  ) => void;
}

export const SituationMapTab: React.FC<SituationMapTabProps> = ({
  isDarkMode,
  onSelectFeature,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Filters state
  const [selectedState, setSelectedState] = useState<StateCode>('TODOS');
  const [selectedSubRegion, setSelectedSubRegion] = useState<SubRegion>('Todas');
  const [selectedRisk, setSelectedRisk] = useState<string>('TODOS');
  const [minFrp, setMinFrp] = useState<number>(0);
  const [baseMapType, setBaseMapType] = useState<'satellite' | 'dark' | 'osm'>('satellite');

  // Layer visibility toggles
  const [showPerimeter, setShowPerimeter] = useState<boolean>(true);
  const [showFires, setShowFires] = useState<boolean>(true);
  const [showRivers, setShowRivers] = useState<boolean>(true);
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [showDeforestation, setShowDeforestation] = useState<boolean>(true);
  const [showCorridors, setShowCorridors] = useState<boolean>(true);
  const [showSpecies, setShowSpecies] = useState<boolean>(true);

  // Filtered fire spots
  const filteredFires = filterFireSpots(FIRE_SPOTS_DATA, {
    state: selectedState,
    subRegion: selectedSubRegion,
    minFrp,
    risk: selectedRisk,
  });

  const fireSummary = summarizeFireSpots(filteredFires);

  // Filter other datasets by state
  const filteredRivers = RIVER_STATIONS_DATA.filter((r) =>
    selectedState === 'TODOS' ? true : r.state === selectedState
  );

  const filteredWeather = WEATHER_STATIONS_DATA.filter((w) =>
    selectedState === 'TODOS' ? true : w.state === selectedState
  );

  const filteredDeforestation = DEFORESTATION_DATA.filter(
    (d) =>
      (selectedState === 'TODOS' || d.state === selectedState) &&
      (selectedSubRegion === 'Todas' || d.subRegion === selectedSubRegion)
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: PANTANAL_BOUNDS.center,
      zoom: PANTANAL_BOUNDS.zoom,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer (Esri Satellite)
    const initialTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri, Maxar, Earthstar Geographics',
        maxZoom: 18,
      }
    ).addTo(map);

    tileLayerRef.current = initialTile;

    const layerGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base map when changed
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let url = '';
    let attr = '';

    if (baseMapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Esri, Maxar, Earthstar Geographics';
    } else if (baseMapType === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attr = '&copy; OpenStreetMap, &copy; CARTO';
    } else {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; OpenStreetMap contributors';
    }

    const newTile = L.tileLayer(url, { attribution: attr, maxZoom: 18 }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [baseMapType]);

  // Render Overlays onto Leaflet LayerGroup
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;

    const group = layersGroupRef.current;
    group.clearLayers();

    // 0. Perímetro Oficial do Bioma Pantanal (Polígono IBGE)
    if (showPerimeter) {
      const perimeter = L.polygon(PANTANAL_BIOME_PERIMETER, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '8, 5',
        fillColor: '#10b981',
        fillOpacity: 0.08,
      });

      perimeter.bindTooltip(
        `<div style="font-size: 11px; line-height: 1.4;">
          <strong style="color: #fbbf24; font-size: 12px;">${PANTANAL_PERIMETER_METADATA.name}</strong><br/>
          <span>Área Oficial: <strong>${PANTANAL_PERIMETER_METADATA.extensionHectares} (${PANTANAL_PERIMETER_METADATA.areaKm2.toLocaleString('pt-BR')} km²)</strong></span><br/>
          <span style="color: #cbd5e1;">${PANTANAL_PERIMETER_METADATA.coverage}</span><br/>
          <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.2);">
            <div style="color: #34d399; font-weight: 600;">Fonte: ${PANTANAL_PERIMETER_METADATA.source}</div>
            <div style="color: #93c5fd; font-weight: 600;">Data: ${PANTANAL_PERIMETER_METADATA.dateFormatted}</div>
          </div>
        </div>`,
        { sticky: true, className: 'leaflet-custom-tooltip' }
      );

      perimeter.on('click', () => {
        onSelectFeature(
          {
            id: 'perimetro-pantanal',
            name: PANTANAL_PERIMETER_METADATA.name,
            category: 'Delimitação Oficial do Bioma',
            areaKm2: PANTANAL_PERIMETER_METADATA.areaKm2,
            description: PANTANAL_PERIMETER_METADATA.description,
            source: PANTANAL_PERIMETER_METADATA.source,
            dateFormatted: PANTANAL_PERIMETER_METADATA.dateFormatted,
            connectivityIndex: 100,
          },
          'corridor'
        );
      });

      group.addLayer(perimeter);
    }

    // 1. Corredores Ecológicos & Áreas Protegidas (Polígonos)
    if (showCorridors) {
      CORRIDORS_DATA.forEach((corridor) => {
        const poly = L.polygon(corridor.coordinates, {
          color: corridor.threatLevel === 'Alto' ? '#ef4444' : '#10b981',
          weight: 2,
          fillColor: corridor.threatLevel === 'Alto' ? '#ef4444' : '#10b981',
          fillOpacity: 0.22,
          dashArray: corridor.category === 'Corredor Ecológico' ? '6, 6' : undefined,
        });

        poly.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong>${corridor.name}</strong><br/>
            <span>${corridor.category} · Conectividade: <strong>${corridor.connectivityIndex}%</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${corridor.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${corridor.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top', sticky: true, className: 'leaflet-custom-tooltip' }
        );

        poly.on('click', () => {
          onSelectFeature(corridor, 'corridor');
        });

        group.addLayer(poly);
      });
    }

    // 2. Focos de Queimadas (INPE)
    if (showFires) {
      filteredFires.forEach((fire) => {
        const isCritical = fire.risk === 'Crítico';
        const color = isCritical ? '#ef4444' : fire.risk === 'Alto' ? '#f97316' : '#eab308';
        const radius = Math.min(18, Math.max(7, fire.frp / 6));

        const iconHtml = `
          <div style="position:relative; width:${radius * 2}px; height:${radius * 2}px;">
            <div style="
              position:absolute; inset:0; border-radius:50%;
              background:${color}; opacity:0.85;
              box-shadow: 0 0 10px ${color};
              animation: ${isCritical ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none'};
            "></div>
            <div style="
              position:absolute; inset:2px; border-radius:50%;
              background:#fff; opacity:0.9; display:flex; align-items:center; justify-content:center;
            ">
              <span style="font-size:9px; font-weight:bold; color:#b91c1c;">🔥</span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'fire-icon',
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius],
        });

        const marker = L.marker([fire.lat, fire.lng], { icon });
        marker.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong style="color: #f87171;">Foco de Calor #${fire.id}</strong><br/>
            <span>${fire.municipality} (${fire.subRegion})</span><br/>
            <span>FRP: <strong>${fire.frp} MW</strong> · Risco: <strong>${fire.risk}</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${fire.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${fire.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top', offset: [0, -radius] }
        );
        marker.on('click', () => {
          onSelectFeature(fire, 'fire');
        });
        group.addLayer(marker);
      });
    }

    // 3. Estações Fluviométricas e Rios (ANA)
    if (showRivers) {
      filteredRivers.forEach((river) => {
        const isDrought = river.status === 'Emergência de Seca';
        const isFlood = river.status === 'Alerta de Cheia';
        const bgColor = isDrought ? '#dc2626' : isFlood ? '#2563eb' : '#0284c7';

        const iconHtml = `
          <div style="
            background: ${bgColor};
            color: #fff;
            padding: 3px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: bold;
            font-family: ui-monospace, monospace;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.7);
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>💧</span>
            <span>${river.currentLevelCm} cm</span>
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'river-icon',
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        });

        const marker = L.marker([river.lat, river.lng], { icon });
        marker.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong style="color: #38bdf8;">${river.name}</strong><br/>
            <span>${river.river} · Nível: <strong>${river.currentLevelCm} cm</strong></span><br/>
            <span>Status: <strong>${river.status}</strong> · Tendência: <strong>${river.trend}</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${river.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${river.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top', offset: [0, -12] }
        );
        marker.on('click', () => {
          onSelectFeature(river, 'river');
        });
        group.addLayer(marker);
      });
    }

    // 4. Estações Meteorológicas (INMET)
    if (showWeather) {
      filteredWeather.forEach((w) => {
        const iconHtml = `
          <div style="
            background: #0f172a;
            color: #f59e0b;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            border: 1px solid #f59e0b;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            white-space: nowrap;
          ">
            🌡️ ${w.tempC}°C | ${w.humidityPercent}%
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'weather-icon',
          iconSize: [90, 22],
          iconAnchor: [45, 11],
        });

        const marker = L.marker([w.lat, w.lng], { icon });
        marker.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong style="color: #fbbf24;">${w.name}</strong><br/>
            <span>Temperatura: <strong>${w.tempC}°C</strong> (Anomalia: <strong>+${w.tempAnomalyC}°C</strong>)</span><br/>
            <span>Umidade Relativa: <strong>${w.humidityPercent}%</strong> · Chuva 24h: <strong>${w.rainLast24hMm} mm</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${w.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${w.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top' }
        );
        marker.on('click', () => {
          onSelectFeature(w, 'weather');
        });
        group.addLayer(marker);
      });
    }

    // 5. Alertas de Desmatamento (DETER / PRODES)
    if (showDeforestation) {
      filteredDeforestation.forEach((d) => {
        const iconHtml = `
          <div style="
            width: 18px;
            height: 18px;
            background: #e11d48;
            border: 2px solid #ffffff;
            border-radius: 4px;
            transform: rotate(45deg);
            box-shadow: 0 0 6px #e11d48;
          "></div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'deforest-icon',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([d.lat, d.lng], { icon });
        marker.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong style="color: #f43f5e;">Alerta DETER/PRODES #${d.id}</strong><br/>
            <span>Área Suprimida: <strong>${d.areaHa} ha</strong> · Tipologia: <strong>${d.vegetationType}</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${d.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${d.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top' }
        );
        marker.on('click', () => {
          onSelectFeature(d, 'deforestation');
        });
        group.addLayer(marker);
      });
    }

    // 6. Espécies e Territórios
    if (showSpecies) {
      BIODIVERSITY_DATA.forEach((sp) => {
        const iconHtml = `
          <div style="
            background: #065f46;
            color: #a7f3d0;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            border: 1px solid #10b981;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          ">
            🐾 ${sp.commonName}
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'species-icon',
          iconSize: [85, 22],
          iconAnchor: [42, 11],
        });

        const marker = L.marker([sp.lat, sp.lng], { icon });
        marker.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4;">
            <strong style="color: #a7f3d0;">${sp.commonName}</strong> (<em>${sp.scientificName}</em>)<br/>
            <span>Status IUCN: <strong>${sp.statusIUCN}</strong> · Pop: <strong>${sp.estimatedPopulation}</strong></span><br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="color: #34d399; font-weight: 600;">Fonte: ${sp.source}</div>
              <div style="color: #93c5fd; font-weight: 600;">Data: ${sp.dateFormatted}</div>
            </div>
          </div>`,
          { direction: 'top' }
        );
        marker.on('click', () => {
          onSelectFeature(sp, 'species');
        });
        group.addLayer(marker);
      });
    }
  }, [
    showPerimeter,
    showCorridors,
    showFires,
    showRivers,
    showWeather,
    showDeforestation,
    showSpecies,
    filteredFires,
    filteredRivers,
    filteredWeather,
    filteredDeforestation,
    onSelectFeature,
  ]);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Top Situational Command Bar with Sources and Dates */}
      <div
        className={`px-4 py-2 border-b-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10 transition-colors ${
          isDarkMode ? 'bg-[#0f172a] border-blue-950 text-slate-100' : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-4 flex-wrap">
          {/* Active fires KPI */}
          <div className="flex items-center gap-2" title="Fonte: INPE BDQueimadas · Coleta: 24/10/2026 16:15">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">Focos Ativos:</span>
            <span className="font-black text-red-600 text-sm">{fireSummary.totalSpots}</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px]">INPE · 24/10/2026</span>
          </div>

          {/* Reference Ladário River Level */}
          <div className="flex items-center gap-2 border-l-2 border-slate-300 dark:border-slate-800 pl-4" title="Fonte: ANA / SGB-CPRM · Leitura: 24/10/2026 07:00">
            <Droplet className="w-3.5 h-3.5 text-[#15347a]" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">Régua Ladário:</span>
            <span className="font-black font-mono text-red-600 dark:text-red-400 text-sm">-18 cm</span>
            <span className="text-[11px] text-red-700 dark:text-red-400 font-extrabold uppercase bg-red-50 dark:bg-red-950 px-1.5 py-0.2 rounded border border-red-200">Emergência</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px]">ANA · Hoje 07:00</span>
          </div>

          {/* Thermal anomaly */}
          <div className="hidden lg:flex items-center gap-2 border-l-2 border-slate-300 dark:border-slate-800 pl-4" title="Fonte: INMET Estações Automáticas · 24/10/2026 16:00">
            <Wind className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">Anomalia Térmica:</span>
            <span className="font-black text-amber-700 dark:text-amber-400">+3,1°C</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px]">INMET · 24/10</span>
          </div>
        </div>

        {/* Basemap Switcher */}
        <div className={`flex items-center gap-1.5 p-1 rounded-lg border-2 ${
          isDarkMode ? 'bg-[#101b38] border-blue-900' : 'bg-white border-slate-300 shadow-2xs'
        }`}>
          <button
            onClick={() => setBaseMapType('satellite')}
            className={`px-3 py-1 rounded text-xs font-extrabold transition-colors ${
              baseMapType === 'satellite'
                ? 'bg-[#15347a] text-white shadow-2xs'
                : isDarkMode
                ? 'text-slate-200 hover:text-white'
                : 'text-slate-800 hover:text-[#0a1c46] hover:bg-blue-50'
            }`}
          >
            Satélite Alta Resolução
          </button>
          <button
            onClick={() => setBaseMapType('dark')}
            className={`px-3 py-1 rounded text-xs font-extrabold transition-colors ${
              baseMapType === 'dark'
                ? 'bg-[#15347a] text-white shadow-2xs'
                : isDarkMode
                ? 'text-slate-200 hover:text-white'
                : 'text-slate-800 hover:text-[#0a1c46] hover:bg-blue-50'
            }`}
          >
            Mapa Noturno
          </button>
          <button
            onClick={() => setBaseMapType('osm')}
            className={`px-3 py-1 rounded text-xs font-extrabold transition-colors ${
              baseMapType === 'osm'
                ? 'bg-[#15347a] text-white shadow-2xs'
                : isDarkMode
                ? 'text-slate-200 hover:text-white'
                : 'text-slate-800 hover:text-[#0a1c46] hover:bg-blue-50'
            }`}
          >
            Topográfico
          </button>
        </div>
      </div>

      {/* Main Map Area with Floating Filters & Layer Controls */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Leaflet container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Left Floating Stack: Filters & Official Legend */}
        <div className="absolute top-4 left-4 z-10 w-72 max-w-[calc(100vw-32px)] max-h-[calc(100vh-140px)] flex flex-col gap-2.5 overflow-y-auto pr-0.5">
          {/* Box 1: Filtros Georreferenciados */}
          <div
            className={`p-3.5 rounded-xl border-2 shadow-xl backdrop-blur-md transition-all shrink-0 ${
              isDarkMode
                ? 'bg-[#0b1329]/95 border-blue-900 text-slate-100'
                : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-slate-200 dark:border-blue-900">
              <div className={`flex items-center gap-1.5 font-black text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-blue-300' : 'text-[#0a1c46]'
              }`}>
                <Filter className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Filtros Georreferenciados</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-100 text-[#15347a]'
              }`}>
                Tempo Real
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* State filter */}
              <div>
                <label htmlFor="select-state" className="block text-slate-900 dark:text-slate-100 text-xs mb-1 font-bold">
                  Estado do Bioma:
                </label>
                <select
                  id="select-state"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value as StateCode)}
                  className={`w-full p-1.5 rounded-lg border-2 text-xs font-bold outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-[#101b38] border-blue-900 text-slate-100 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-[#15347a]'
                  }`}
                >
                  <option value="TODOS">Todos os Estados (MS & MT)</option>
                  <option value="MS">Mato Grosso do Sul (Pantanal Sul)</option>
                  <option value="MT">Mato Grosso (Pantanal Norte)</option>
                </select>
              </div>

              {/* Sub-region filter */}
              <div>
                <label htmlFor="select-subregion" className="block text-slate-700 dark:text-slate-300 text-[11px] mb-1 font-bold">
                  Sub-região do Pantanal:
                </label>
                <select
                  id="select-subregion"
                  value={selectedSubRegion}
                  onChange={(e) => setSelectedSubRegion(e.target.value as SubRegion)}
                  className={`w-full p-1.5 rounded-lg border-2 text-xs font-bold outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-[#101b38] border-blue-900 text-slate-200 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-[#15347a]'
                  }`}
                >
                  <option value="Todas">Todas as Sub-regiões</option>
                  <option value="Nhecolândia">Nhecolândia</option>
                  <option value="Poconé">Poconé / Transpantaneira</option>
                  <option value="Barão de Melgaço">Barão de Melgaço</option>
                  <option value="Cáceres">Cáceres</option>
                  <option value="Paiaguás">Paiaguás</option>
                  <option value="Miranda">Miranda</option>
                  <option value="Abobral">Abobral</option>
                  <option value="Porto Murtinho">Porto Murtinho</option>
                  <option value="Aquidauana">Aquidauana</option>
                </select>
              </div>

              {/* Fire risk filter */}
              <div>
                <label htmlFor="select-fire-risk" className="block text-slate-700 dark:text-slate-300 text-[11px] mb-1 font-bold">
                  Severidade do Fogo:
                </label>
                <select
                  id="select-fire-risk"
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className={`w-full p-1.5 rounded-lg border-2 text-xs font-bold outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-[#101b38] border-blue-900 text-slate-200 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-800 focus:border-[#15347a]'
                  }`}
                >
                  <option value="TODOS">Todos os Riscos</option>
                  <option value="Crítico">Apenas Crítico (Emergencial)</option>
                  <option value="Alto">Alto e Superior</option>
                  <option value="Médio">Médio</option>
                  <option value="Baixo">Baixo</option>
                </select>
              </div>

              {/* Min FRP slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300 mb-1 font-bold">
                  <span>Potência Mínima (FRP):</span>
                  <span className={`font-black font-mono ${
                    isDarkMode ? 'text-blue-300' : 'text-[#15347a]'
                  }`}>{minFrp} MW</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minFrp}
                  onChange={(e) => setMinFrp(Number(e.target.value))}
                  aria-label="Filtro de potência mínima do fogo em MW"
                  className="w-full accent-[#15347a] cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Box 2: Legenda Oficial (Abaixo dos Filtros Georreferenciados) */}
          <div
            className={`p-3 rounded-xl border-2 shadow-xl backdrop-blur-md transition-all shrink-0 ${
              isDarkMode
                ? 'bg-[#0b1329]/95 border-blue-900 text-slate-100'
                : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-slate-200 dark:border-blue-900">
              <div className={`flex items-center gap-1.5 font-black text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-blue-300' : 'text-[#0a1c46]'
              }`}>
                <Info className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Legenda Oficial</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-[#15347a] border border-blue-200'
              }`}>
                Convenções
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-1.5" title="Fonte: IBGE 1:250.000 (MMA 2026)">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-2.5 border-2 border-dashed border-amber-500 bg-amber-500/30 inline-block rounded-xs shrink-0"></span>
                  <span className="text-amber-800 dark:text-amber-300 font-black text-[11px]">Perímetro Pantanal</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">IBGE</span>
              </div>

              <div className="flex items-center justify-between gap-1.5" title="Fonte: INPE BDQueimadas (24/10/2026)">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-600 inline-block animate-pulse shrink-0"></span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">Queimada Crítica</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">INPE</span>
              </div>

              <div className="flex items-center justify-between gap-1.5" title="Fonte: Agência Nacional de Águas - ANA (24/10/2026)">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#15347a] inline-block shrink-0"></span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">Régua Fluviométrica</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">ANA</span>
              </div>

              <div className="flex items-center justify-between gap-1.5" title="Fonte: INPE DETER Pantanal (Out/2026)">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rotate-45 bg-red-600 inline-block shrink-0"></span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">Alerta DETER</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">DETER</span>
              </div>

              <div className="flex items-center justify-between gap-1.5" title="Fonte: ICMBio / IHP (2026)">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-2.5 bg-blue-500/40 border-2 border-blue-600 inline-block shrink-0"></span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">Corredor Ecológico</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">ICMBio</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-700 dark:text-slate-300 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-blue-900 flex items-center justify-between gap-2 font-semibold">
              <span>Dados oficiais com data/hora</span>
              <span className="text-[#15347a] dark:text-blue-300 font-black whitespace-nowrap">INPP · MCTI</span>
            </div>
          </div>
        </div>

        {/* Right Floating Layer Visibility Selector */}
        <div
          className={`absolute top-4 right-4 z-10 w-68 max-w-[calc(100vw-32px)] max-h-[calc(100vh-130px)] overflow-y-auto p-3.5 rounded-xl border-2 shadow-xl backdrop-blur-md transition-all ${
            isDarkMode
              ? 'bg-[#0b1329]/95 border-blue-900 text-slate-100'
              : 'bg-white/95 border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b-2 border-slate-200 dark:border-blue-900">
            <div className={`flex items-center gap-1.5 font-black text-xs uppercase tracking-wider ${
              isDarkMode ? 'text-blue-300' : 'text-[#0a1c46]'
            }`}>
              <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Camadas de Sobreposição</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {/* Perímetro do Pantanal */}
            <div className={`p-1.5 rounded-lg border transition-colors ${
              isDarkMode
                ? 'border-amber-500/30 bg-amber-500/5 hover:bg-blue-950/40'
                : 'border-amber-400/40 bg-amber-50/40 hover:bg-amber-50'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-dashed border-amber-500 rounded-xs inline-block"></span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Perímetro do Pantanal</span>
                </div>
                <input
                  type="checkbox"
                  checked={showPerimeter}
                  onChange={(e) => setShowPerimeter(e.target.checked)}
                  className="rounded accent-[#244b9b] w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">IBGE (Biomas 1:250k)</span> · 2026
              </div>
            </div>

            {/* Queimadas */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-medium">Queimadas & Focos</span>
                </div>
                <input
                  type="checkbox"
                  checked={showFires}
                  onChange={(e) => setShowFires(e.target.checked)}
                  className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">INPE BDQueimadas</span> · 24/10/2026
              </div>
            </div>

            {/* Rios e Cotas */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Droplet className="w-3.5 h-3.5 text-[#244b9b]" />
                  <span className="font-medium">Rios & Cotas Fluviométricas</span>
                </div>
                <input
                  type="checkbox"
                  checked={showRivers}
                  onChange={(e) => setShowRivers(e.target.checked)}
                  className="rounded accent-[#244b9b] w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">ANA / SGB-CPRM</span> · Hoje 09:00
              </div>
            </div>

            {/* Clima & Chuva */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Wind className="w-3.5 h-3.5 text-sky-600" />
                  <span className="font-medium">Clima, Chuva & Temperatura</span>
                </div>
                <input
                  type="checkbox"
                  checked={showWeather}
                  onChange={(e) => setShowWeather(e.target.checked)}
                  className="rounded accent-[#244b9b] w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">INMET Automáticas</span> · 24/10 16:00
              </div>
            </div>

            {/* Desmatamento */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-medium">Alertas de Desmatamento</span>
                </div>
                <input
                  type="checkbox"
                  checked={showDeforestation}
                  onChange={(e) => setShowDeforestation(e.target.checked)}
                  className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">INPE DETER/PRODES</span> · Out/2026
              </div>
            </div>

            {/* Corredores e UCs */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-medium">Corredores Ecológicos & UCs</span>
                </div>
                <input
                  type="checkbox"
                  checked={showCorridors}
                  onChange={(e) => setShowCorridors(e.target.checked)}
                  className="rounded accent-[#244b9b] w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">ICMBio / IHP / CNUC</span> · Base 2026
              </div>
            </div>

            {/* Espécies */}
            <div className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-blue-950/40' : 'hover:bg-blue-50/60'
            }`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🐾</span>
                  <span className="font-medium">Espécies Bioindicadoras</span>
                </div>
                <input
                  type="checkbox"
                  checked={showSpecies}
                  onChange={(e) => setShowSpecies(e.target.checked)}
                  className="rounded accent-[#244b9b] w-4 h-4 cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                Fonte: <span className="font-medium text-slate-700 dark:text-slate-300">ICMBio & IUCN Red List</span> · 2026
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
