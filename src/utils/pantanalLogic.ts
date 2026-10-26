import {
  FireSpot,
  RiverStation,
  SubRegion,
  StateCode,
} from '../types/pantanal.ts';

/**
 * Classifies river gauge status based on critical drought and flood thresholds
 */
export function classifyRiverStatus(
  currentCm: number,
  alertFloodCm: number,
  criticalDroughtCm: number
): 'Normal' | 'Alerta de Cheia' | 'Emergência de Seca' | 'Atenção' {
  if (currentCm >= alertFloodCm) {
    return 'Alerta de Cheia';
  }
  if (currentCm <= criticalDroughtCm) {
    return 'Emergência de Seca';
  }
  if (currentCm <= criticalDroughtCm + 50) {
    return 'Atenção';
  }
  return 'Normal';
}

/**
 * Filters fire spots by state, sub-region, minimum Fire Radiative Power (MW) and risk level
 */
export function filterFireSpots(
  spots: FireSpot[],
  options: {
    state?: StateCode;
    subRegion?: SubRegion;
    minFrp?: number;
    risk?: string;
  }
): FireSpot[] {
  const { state = 'TODOS', subRegion = 'Todas', minFrp = 0, risk = 'TODOS' } = options;

  return spots.filter((spot) => {
    if (state !== 'TODOS' && spot.state !== state) return false;
    if (subRegion !== 'Todas' && spot.subRegion !== subRegion) return false;
    if (spot.frp < minFrp) return false;
    if (risk !== 'TODOS' && spot.risk !== risk) return false;
    return true;
  });
}

/**
 * Computes statistical summary for fire spots
 */
export function summarizeFireSpots(spots: FireSpot[]) {
  const count = spots.length;
  if (count === 0) {
    return {
      totalSpots: 0,
      averageFrp: 0,
      maxFrp: 0,
      criticalSpotsCount: 0,
      topMunicipality: 'N/A',
    };
  }

  let totalFrp = 0;
  let maxFrp = 0;
  let criticalSpotsCount = 0;
  const municipalityCounts: Record<string, number> = {};

  for (const spot of spots) {
    totalFrp += spot.frp;
    if (spot.frp > maxFrp) maxFrp = spot.frp;
    if (spot.risk === 'Crítico' || spot.risk === 'Alto') criticalSpotsCount++;
    municipalityCounts[spot.municipality] = (municipalityCounts[spot.municipality] || 0) + 1;
  }

  let topMunicipality = '';
  let topCount = -1;
  for (const [muni, c] of Object.entries(municipalityCounts)) {
    if (c > topCount) {
      topCount = c;
      topMunicipality = muni;
    }
  }

  return {
    totalSpots: count,
    averageFrp: Math.round((totalFrp / count) * 10) / 10,
    maxFrp: Math.round(maxFrp * 10) / 10,
    criticalSpotsCount,
    topMunicipality,
  };
}

/**
 * Computes Pearson correlation coefficient between two numeric arrays
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);

  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return Math.round((numerator / denominator) * 100) / 100;
}

/**
 * Formats hectares into readable string with Brazilian thousand separators
 */
export function formatHectares(ha: number): string {
  if (ha >= 1_000_000) {
    return `${(ha / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M ha`;
  }
  return `${ha.toLocaleString('pt-BR')} ha`;
}

/**
 * Formats water gauge level in meters and cm
 */
export function formatRiverLevel(cm: number): string {
  const m = cm / 100;
  return `${m >= 0 ? '+' : ''}${m.toFixed(2)} m (${cm} cm)`;
}

/**
 * Formats a percentage value into Brazilian locale with symbol e.g. "1,8%"
 */
export function formatPercentage(val: number, decimals: number = 1): string {
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}
