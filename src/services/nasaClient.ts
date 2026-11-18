import type { NasaMissionDataset } from '../types/game';

const STORAGE_KEY = 'lunarbase_nasa_dataset_v1';

const FALLBACK_SIMULATED: NasaMissionDataset = {
  donkiStatus: 'simulated',
  radlabStatus: 'simulated',
  donkiRange: { startDate: '2026-11-01', endDate: '2026-11-15' },
  fetchedAt: new Date().toISOString(),
  donkiEvents: {
    cme: [],
    sep: [],
    flr: [],
    gst: [],
  },
  radlabRecords: [],
  featuredDay3Scenario: {
    title: 'Simulated Solar Particle Warning',
    primaryEvent: null,
    hasConfirmedSep: false,
    isSimulationInspired: true,
    briefSummary:
      'Simulated solar particle alert (NASA API unreachable). Shelter crew to keep simulated exposure low.',
    scientificNote:
      'In simulation mode, events are synthetic training scenarios rather than live NASA observations.',
  },
  featuredDay5Scenario: {
    title: 'Simulated Final-Day Solar Wave',
    primaryEvent: null,
    hasConfirmedSep: false,
    isSimulationInspired: true,
    briefSummary:
      'Simulated late-mission space-weather surge testing power and shielding reserves.',
  },
};

export async function loadNasaMissionDataset(forceRefresh = false): Promise<NasaMissionDataset> {
  try {
    const res = await fetch(`/api/nasa/mission-data${forceRefresh ? '?refresh=1' : ''}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as NasaMissionDataset;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
    return data;
  } catch {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as NasaMissionDataset;
        return {
          ...parsed,
          donkiStatus: parsed.donkiEvents.cme.length > 0 || parsed.donkiEvents.sep.length > 0 ? 'cached' : 'simulated',
          radlabStatus: parsed.radlabRecords.length > 0 ? 'cached' : 'simulated',
        };
      }
    } catch {
      // Ignore parse errors
    }
    return FALLBACK_SIMULATED;
  }
}
