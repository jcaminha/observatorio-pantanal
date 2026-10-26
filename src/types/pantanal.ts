export type SubRegion =
  | 'Todas'
  | 'Nhecolândia'
  | 'Poconé'
  | 'Cáceres'
  | 'Miranda'
  | 'Abobral'
  | 'Nabileque'
  | 'Paiaguás'
  | 'Barão de Melgaço'
  | 'Porto Murtinho'
  | 'Aquidauana';

export type StateCode = 'TODOS' | 'MS' | 'MT';

export interface FireSpot {
  id: string;
  lat: number;
  lng: number;
  municipality: string;
  state: 'MS' | 'MT';
  subRegion: SubRegion;
  frp: number; // Fire Radiative Power in MW
  risk: 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  confidence: number; // percentage
  timestamp: string;
  satellite: string; // ex: AQUA_M-T, NOAA-20
  source: string;
  dateFormatted: string;
}

export interface RiverStation {
  id: string;
  name: string;
  river: string;
  lat: number;
  lng: number;
  municipality: string;
  state: 'MS' | 'MT';
  currentLevelCm: number;
  normalLevelCm: number;
  alertFloodLevelCm: number;
  criticalDroughtLevelCm: number;
  trend: 'subindo' | 'descendo' | 'estável';
  status: 'Normal' | 'Alerta de Cheia' | 'Emergência de Seca' | 'Atenção';
  lastUpdated: string;
  historicalRecord: { year: number; levelCm: number }[];
  source: string;
  dateFormatted: string;
}

export interface WeatherStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  municipality: string;
  state: 'MS' | 'MT';
  tempC: number;
  tempAnomalyC: number;
  humidityPercent: number;
  rainLast24hMm: number;
  rainLast7dMm: number;
  rainMonthAccumulatedMm: number;
  rainMonthNormalMm: number;
  source: string;
  dateFormatted: string;
}

export interface DeforestationAlert {
  id: string;
  lat: number;
  lng: number;
  municipality: string;
  state: 'MS' | 'MT';
  subRegion: SubRegion;
  areaHa: number;
  vegetationType: 'Savana Florestada' | 'Formação Pioneira Úmida' | 'Mata de Galeria' | 'Campo Limpo';
  date: string;
  system: 'DETER' | 'PRODES';
  source: string;
  dateFormatted: string;
}

export interface EcologicalCorridor {
  id: string;
  name: string;
  category: 'Corredor Ecológico' | 'Parque Nacional' | 'RPPN' | 'Estação Ecológica' | 'APA';
  areaKm2: number;
  state: 'MS' | 'MT' | 'Ambos';
  description: string;
  coordinates: [number, number][]; // Polygon or polyline
  threatLevel: 'Baixo' | 'Médio' | 'Alto';
  connectivityIndex: number; // 0-100
  source: string;
  dateFormatted: string;
}

export interface BiodiversitySpecies {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  taxa: 'Mamífero' | 'Ave' | 'Réptil' | 'Peixe' | 'Planta';
  statusIUCN: 'Criticamente em Perigo' | 'Em Perigo' | 'Vulnerável' | 'Quase Ameaçada' | 'Pouco Preocupante';
  endemic: boolean;
  indicatorSpecies: boolean;
  estimatedPopulation: string;
  habitat: string;
  description: string;
  keyThreats: string[];
  lat: number;
  lng: number;
  photoUrl: string;
  source: string;
  dateFormatted: string;
}

export interface LandCoverYear {
  year: number;
  forestHa: number;
  savannaHa: number;
  wetlandGrasslandHa: number;
  pastureHa: number;
  waterSurfaceHa: number;
  otherHa: number;
  waterCoverPercentage: number;
  ndviAverage: number;
}

export interface EconomicIndicator {
  sector: 'Pecuária' | 'Agricultura' | 'Turismo' | 'Bioeconomia';
  metric: string;
  value: string;
  unit: string;
  trend: string;
  detail: string;
  source: string;
}

export type ActiveTab = 'situacao' | 'series' | 'economia' | 'biodiversidade' | 'cobertura';
