import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRiverStatus,
  filterFireSpots,
  summarizeFireSpots,
  calculatePearsonCorrelation,
  formatRiverLevel,
  formatHectares,
  formatPercentage,
} from './pantanalLogic.ts';
import { FireSpot } from '../types/pantanal.ts';

test('classifyRiverStatus detects critical drought correctly', () => {
  // Ladário critical drought is under 0 cm
  assert.equal(classifyRiverStatus(-25, 600, 0), 'Emergência de Seca');
  assert.equal(classifyRiverStatus(30, 600, 0), 'Atenção');
  assert.equal(classifyRiverStatus(250, 600, 0), 'Normal');
  assert.equal(classifyRiverStatus(650, 600, 0), 'Alerta de Cheia');
});

test('filterFireSpots filters correctly by state and risk', () => {
  const dummySpots: FireSpot[] = [
    {
      id: '1',
      lat: -19.0,
      lng: -57.5,
      municipality: 'Corumbá',
      state: 'MS',
      subRegion: 'Nhecolândia',
      frp: 45,
      risk: 'Crítico',
      confidence: 95,
      timestamp: '2026-10-24T12:00:00Z',
      satellite: 'AQUA',
      source: 'INPE BDQueimadas',
      dateFormatted: '24/10/2026 12:00',
    },
    {
      id: '2',
      lat: -16.5,
      lng: -56.5,
      municipality: 'Poconé',
      state: 'MT',
      subRegion: 'Poconé',
      frp: 12,
      risk: 'Médio',
      confidence: 70,
      timestamp: '2026-10-24T12:00:00Z',
      satellite: 'NOAA-20',
      source: 'INPE BDQueimadas',
      dateFormatted: '24/10/2026 12:00',
    },
    {
      id: '3',
      lat: -18.8,
      lng: -57.0,
      municipality: 'Corumbá',
      state: 'MS',
      subRegion: 'Nhecolândia',
      frp: 80,
      risk: 'Crítico',
      confidence: 99,
      timestamp: '2026-10-24T14:00:00Z',
      satellite: 'AQUA',
      source: 'INPE BDQueimadas',
      dateFormatted: '24/10/2026 14:00',
    },
  ];

  const msOnly = filterFireSpots(dummySpots, { state: 'MS' });
  assert.equal(msOnly.length, 2);

  const mtOnly = filterFireSpots(dummySpots, { state: 'MT' });
  assert.equal(mtOnly.length, 1);

  const criticalOnly = filterFireSpots(dummySpots, { risk: 'Crítico' });
  assert.equal(criticalOnly.length, 2);

  const minFrp50 = filterFireSpots(dummySpots, { minFrp: 50 });
  assert.equal(minFrp50.length, 1);
  assert.equal(minFrp50[0].id, '3');
});

test('summarizeFireSpots calculates correct statistics', () => {
  const dummySpots: FireSpot[] = [
    {
      id: '1',
      lat: -19.0,
      lng: -57.5,
      municipality: 'Corumbá',
      state: 'MS',
      subRegion: 'Nhecolândia',
      frp: 40,
      risk: 'Crítico',
      confidence: 95,
      timestamp: '2026-10-24T12:00:00Z',
      satellite: 'AQUA',
      source: 'INPE BDQueimadas',
      dateFormatted: '24/10/2026 12:00',
    },
    {
      id: '2',
      lat: -18.8,
      lng: -57.0,
      municipality: 'Corumbá',
      state: 'MS',
      subRegion: 'Nhecolândia',
      frp: 60,
      risk: 'Crítico',
      confidence: 99,
      timestamp: '2026-10-24T14:00:00Z',
      satellite: 'AQUA',
      source: 'INPE BDQueimadas',
      dateFormatted: '24/10/2026 14:00',
    },
  ];

  const summary = summarizeFireSpots(dummySpots);
  assert.equal(summary.totalSpots, 2);
  assert.equal(summary.averageFrp, 50);
  assert.equal(summary.maxFrp, 60);
  assert.equal(summary.criticalSpotsCount, 2);
  assert.equal(summary.topMunicipality, 'Corumbá');
});

test('calculatePearsonCorrelation computes standard statistical correlation', () => {
  const seriesA = [1, 2, 3, 4, 5];
  const seriesB = [2, 4, 6, 8, 10];
  const corr = calculatePearsonCorrelation(seriesA, seriesB);
  assert.equal(corr, 1);

  const inverseB = [10, 8, 6, 4, 2];
  const invCorr = calculatePearsonCorrelation(seriesA, inverseB);
  assert.equal(invCorr, -1);
});

test('formatRiverLevel and formatHectares format values nicely', () => {
  assert.equal(formatRiverLevel(120), '+1.20 m (120 cm)');
  assert.equal(formatRiverLevel(-35), '-0.35 m (-35 cm)');
  assert.equal(formatHectares(1500000), '1,5M ha');
  assert.equal(formatHectares(450), '450 ha');
  assert.equal(formatPercentage(1.8, 1), '1,8%');
  assert.equal(formatPercentage(42.0, 1), '42,0%');
});
