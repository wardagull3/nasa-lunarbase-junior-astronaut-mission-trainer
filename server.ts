import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const NASA_API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const CACHE_FILE = path.join(os.tmpdir(), 'lunarbase-nasa-cache.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface DonkiEventRecord {
  id: string;
  eventType: 'CME' | 'SEP' | 'FLR' | 'GST';
  startTime: string;
  sourceLocation: string | null;
  instruments: string[];
  note: string | null;
  link: string | null;
  linkedEvents: Array<{ activityID: string }>;
  cmeSpeedKmS: number | null;
  cmeHalfAngle: number | null;
  cmeType: string | null;
  flareClass: string | null;
  kpIndex: number | null;
  rawAnalysis?: Record<string, unknown> | null;
}

interface RadLabRecord {
  timestamp: string;
  spacecraft: string;
  instrument: string;
  instrument_id: string | null;
  absorbed_dose_rate: number | null;
  dose_equivalent_rate: number | null;
  flux: number | null;
}

interface CachedPayload {
  fetchedAt: string;
  donkiRange: { startDate: string; endDate: string };
  donkiEvents: {
    cme: DonkiEventRecord[];
    sep: DonkiEventRecord[];
    flr: DonkiEventRecord[];
    gst: DonkiEventRecord[];
  } | null;
  radlabRecords: RadLabRecord[] | null;
}

let memoryCache: { data: CachedPayload; timestamp: number } | null = null;

async function readDiskCache(): Promise<CachedPayload | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed && (parsed.donkiEvents || parsed.radlabRecords)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeDiskCache(data: CachedPayload): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(data), 'utf8');
  } catch {
    // Non-fatal in read-only filesystems
  }
}

function parseDonkiList(
  raw: unknown,
  eventType: 'CME' | 'SEP' | 'FLR' | 'GST',
): DonkiEventRecord[] {
  if (!Array.isArray(raw)) return [];
  const results: DonkiEventRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = String(
      rec.activityID ?? rec.sepID ?? rec.flrID ?? rec.gstID ?? `${eventType}-UNKNOWN`,
    );
    const startTime = String(rec.startTime ?? rec.eventTime ?? '');
    const instruments = Array.isArray(rec.instruments)
      ? rec.instruments
          .map((inst) =>
            inst && typeof inst === 'object' && 'displayName' in inst
              ? String((inst as { displayName?: unknown }).displayName ?? '')
              : '',
          )
          .filter(Boolean)
      : [];

    const linkedEvents = Array.isArray(rec.linkedEvents)
      ? rec.linkedEvents
          .filter((le): le is { activityID: string } =>
            Boolean(le && typeof le === 'object' && 'activityID' in le),
          )
          .map((le) => ({ activityID: String(le.activityID) }))
      : [];

    let cmeSpeedKmS: number | null = null;
    let cmeHalfAngle: number | null = null;
    let cmeType: string | null = null;
    let rawAnalysis: Record<string, unknown> | null = null;

    if (eventType === 'CME' && Array.isArray(rec.cmeAnalyses) && rec.cmeAnalyses.length > 0) {
      const analyses = rec.cmeAnalyses as Array<Record<string, unknown>>;
      const best = analyses.find((a) => a.isMostAccurate === true) ?? analyses[0];
      if (best) {
        rawAnalysis = best;
        cmeSpeedKmS = typeof best.speed === 'number' ? best.speed : null;
        cmeHalfAngle = typeof best.halfAngle === 'number' ? best.halfAngle : null;
        cmeType = typeof best.type === 'string' ? best.type : null;
      }
    }

    let kpIndex: number | null = null;
    if (eventType === 'GST' && Array.isArray(rec.allKpIndex) && rec.allKpIndex.length > 0) {
      const kps = rec.allKpIndex
        .map((k) =>
          k && typeof k === 'object' && typeof (k as { kpIndex?: unknown }).kpIndex === 'number'
            ? (k as { kpIndex: number }).kpIndex
            : 0,
        );
      if (kps.length > 0) kpIndex = Math.max(...kps);
    }

    results.push({
      id,
      eventType,
      startTime,
      sourceLocation: typeof rec.sourceLocation === 'string' ? rec.sourceLocation : null,
      instruments,
      note: typeof rec.note === 'string' ? rec.note : null,
      link: typeof rec.link === 'string' ? rec.link : null,
      linkedEvents,
      cmeSpeedKmS,
      cmeHalfAngle,
      cmeType,
      flareClass: typeof rec.classType === 'string' ? rec.classType : null,
      kpIndex,
      rawAnalysis,
    });
  }
  return results;
}

function parseRadLabJson(raw: unknown): RadLabRecord[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as { columns?: unknown; data?: unknown };
  if (!Array.isArray(obj.columns) || !Array.isArray(obj.data)) return [];
  const cols = obj.columns.map((c) => String(c));
  const idx = {
    timestamp: cols.indexOf('timestamp'),
    spacecraft: cols.indexOf('spacecraft'),
    instrument: cols.indexOf('instrument'),
    instrument_id: cols.indexOf('instrument_id'),
    absorbed_dose_rate: cols.indexOf('absorbed_dose_rate'),
    dose_equivalent_rate: cols.indexOf('dose_equivalent_rate'),
    flux: cols.indexOf('flux'),
  };

  const rows: RadLabRecord[] = [];
  for (const row of obj.data) {
    if (!Array.isArray(row)) continue;
    const toNum = (i: number) =>
      i >= 0 && typeof row[i] === 'number' && Number.isFinite(row[i] as number)
        ? (row[i] as number)
        : null;
    rows.push({
      timestamp: idx.timestamp >= 0 ? String(row[idx.timestamp] ?? '') : '',
      spacecraft: idx.spacecraft >= 0 ? String(row[idx.spacecraft] ?? 'ISS') : 'ISS',
      instrument: idx.instrument >= 0 ? String(row[idx.instrument] ?? 'DosTel') : 'DosTel',
      instrument_id:
        idx.instrument_id >= 0 && row[idx.instrument_id] != null
          ? String(row[idx.instrument_id])
          : null,
      absorbed_dose_rate: toNum(idx.absorbed_dose_rate),
      dose_equivalent_rate: toNum(idx.dose_equivalent_rate),
      flux: toNum(idx.flux),
    });
  }
  return rows.slice(0, 24);
}

async function fetchJsonSafe(url: string, timeoutMs = 8000): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, data: null };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

async function fetchDonkiEndpoint(
  endpoint: 'CME' | 'SEP' | 'FLR' | 'GST',
  startDate: string,
  endDate: string,
) {
  const apiUrl = `https://api.nasa.gov/DONKI/${endpoint}?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;
  const primary = await fetchJsonSafe(apiUrl, 7000);
  if (primary.ok && Array.isArray(primary.data)) {
    return { ok: true, data: primary.data };
  }
  // Fallback to official NASA CCMC DONKI endpoint if api.nasa.gov DEMO_KEY rate-limits or 404s
  const ccmcUrl = `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/${endpoint}?startDate=${startDate}&endDate=${endDate}`;
  const secondary = await fetchJsonSafe(ccmcUrl, 9000);
  if (secondary.ok && Array.isArray(secondary.data)) {
    return { ok: true, data: secondary.data };
  }
  return { ok: false, data: null };
}

type DonkiEventsMap = NonNullable<CachedPayload['donkiEvents']>;

function buildSimulatedDonkiEvents(startDate: string): DonkiEventsMap {
  return {
    cme: [
      {
        id: 'SIM-CME-001',
        eventType: 'CME',
        startTime: `${startDate}T08:30Z`,
        sourceLocation: 'S14W22',
        instruments: ['Simulated Solar Coronagraph'],
        note: 'Simulated coronal mass ejection used when NASA DONKI API is unreachable.',
        link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
        linkedEvents: [],
        cmeSpeedKmS: 920,
        cmeHalfAngle: 26,
        cmeType: 'C',
        flareClass: null,
        kpIndex: null,
        rawAnalysis: null,
      },
    ],
    sep: [
      {
        id: 'SIM-SEP-001',
        eventType: 'SEP',
        startTime: `${startDate}T11:15Z`,
        sourceLocation: null,
        instruments: ['Simulated Energetic Particle Sensor'],
        note: 'Simulated solar energetic particle scenario used when NASA DONKI API is unreachable.',
        link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
        linkedEvents: [],
        cmeSpeedKmS: null,
        cmeHalfAngle: null,
        cmeType: null,
        flareClass: null,
        kpIndex: null,
        rawAnalysis: null,
      },
    ],
    flr: [],
    gst: [],
  };
}

function selectFeaturedScenarios(events: DonkiEventsMap) {
  const sep = events.sep[0] ?? null;
  const sortedCmes = [...events.cme].sort(
    (a, b) => (b.cmeSpeedKmS ?? 0) - (a.cmeSpeedKmS ?? 0),
  );
  const topCme = sortedCmes[0] ?? null;
  const secondaryCme = sortedCmes[1] ?? topCme;
  const gst = events.gst[0] ?? null;
  const flr = events.flr[0] ?? null;

  if (sep) {
    return {
      featuredDay3Scenario: {
        title: `Solar Energetic Particle Alert (${sep.id})`,
        primaryEvent: sep,
        hasConfirmedSep: true,
        isSimulationInspired: false,
        briefSummary:
          'Recorded NASA DONKI SEP particle event detected. High-energy solar protons require shelter protection.',
        scientificNote:
          'Solar energetic particles (SEPs) travel near light speed and pose direct radiation risk outside Earth’s magnetic field.',
      },
      featuredDay5Scenario: {
        title: topCme
          ? `Coronal Mass Ejection Surge (${topCme.id})`
          : 'Late-Mission Solar Particle Wave',
        primaryEvent: topCme ?? sep,
        hasConfirmedSep: Boolean(events.sep[1]),
        isSimulationInspired: !events.sep[1],
        briefSummary: topCme
          ? `Simulated particle surge inspired by NASA CME ${topCme.id}${topCme.cmeSpeedKmS ? ` (${topCme.cmeSpeedKmS} km/s)` : ''}.`
          : 'Simulated final-day solar weather drill testing crew shielding and battery reserves.',
      },
    };
  }

  if (topCme) {
    const speedTxt = topCme.cmeSpeedKmS ? ` (~${Math.round(topCme.cmeSpeedKmS)} km/s)` : '';
    const hasLinkedSep = topCme.linkedEvents.some((e) => e.activityID.includes('SEP'));
    return {
      featuredDay3Scenario: {
        title: `Solar Activity Warning — Inspired by ${topCme.id}`,
        primaryEvent: topCme,
        hasConfirmedSep: hasLinkedSep,
        isSimulationInspired: !hasLinkedSep,
        briefSummary: hasLinkedSep
          ? `NASA DONKI recorded CME ${topCme.id}${speedTxt} with a linked particle event.`
          : `Educational radiation drill inspired by NASA CME ${topCme.id}${speedTxt}. No SEP was recorded in this window—we simulate a particle surge for crew training.`,
        scientificNote:
          'A CME is a cloud of magnetized solar plasma and does not automatically produce dangerous lunar surface radiation unless accompanied by an SEP event.',
      },
      featuredDay5Scenario: {
        title: secondaryCme
          ? `Day 5 Space-Weather Drill — ${secondaryCme.id}`
          : gst
            ? `Geomagnetic Reference (${gst.id})`
            : flr
              ? `Solar Flare Reference (${flr.id})`
              : 'Day 5 Final Solar Activity Drill',
        primaryEvent: secondaryCme ?? gst ?? flr,
        hasConfirmedSep: false,
        isSimulationInspired: true,
        briefSummary: secondaryCme
          ? `Simulated Day 5 solar storm inspired by NASA CME ${secondaryCme.id}${secondaryCme.cmeSpeedKmS ? ` (${Math.round(secondaryCme.cmeSpeedKmS)} km/s)` : ''}.`
          : 'Simulated final-day solar storm scenario to test remaining base power and shelter discipline.',
      },
    };
  }

  return {
    featuredDay3Scenario: {
      title: 'Simulated Solar Particle Warning',
      primaryEvent: null,
      hasConfirmedSep: false,
      isSimulationInspired: true,
      briefSummary:
        'Simulated solar particle alert (no NASA DONKI SEP/CME record available). Shelter crew to limit simulated dose.',
      scientificNote:
        'This is an educational simulation scenario because no matching NASA observation was loaded.',
    },
    featuredDay5Scenario: {
      title: 'Simulated Final-Day Radiation Surge',
      primaryEvent: null,
      hasConfirmedSep: false,
      isSimulationInspired: true,
      briefSummary:
        'Simulated Day 5 space-weather surge testing power, oxygen, and shelter protection together.',
    },
  };
}

async function getNasaMissionData(forceRefresh = false) {
  const startDate = '2026-11-01';
  const endDate = '2026-11-15';

  if (
    !forceRefresh &&
    memoryCache &&
    Date.now() - memoryCache.timestamp < CACHE_TTL_MS &&
    memoryCache.data.donkiEvents &&
    memoryCache.data.radlabRecords
  ) {
    const scenarios = selectFeaturedScenarios(memoryCache.data.donkiEvents);
    return {
      donkiStatus: 'cached' as const,
      radlabStatus: 'cached' as const,
      fetchedAt: memoryCache.data.fetchedAt,
      donkiRange: memoryCache.data.donkiRange,
      donkiEvents: memoryCache.data.donkiEvents,
      radlabRecords: memoryCache.data.radlabRecords,
      ...scenarios,
    };
  }

  const radlabUrl =
    'https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23:00&timestamp%3C2022-04-02T01:05&absorbed_dose_rate&dose_equivalent_rate&flux&format=json';

  const [cmeRes, sepRes, flrRes, gstRes, radlabRes] = await Promise.all([
    fetchDonkiEndpoint('CME', startDate, endDate),
    fetchDonkiEndpoint('SEP', startDate, endDate),
    fetchDonkiEndpoint('FLR', startDate, endDate),
    fetchDonkiEndpoint('GST', startDate, endDate),
    fetchJsonSafe(radlabUrl, 10000),
  ]);

  const donkiLiveOk = cmeRes.ok || sepRes.ok || flrRes.ok || gstRes.ok;
  const parsedRadLab = radlabRes.ok ? parseRadLabJson(radlabRes.data) : [];
  const radlabLiveOk = parsedRadLab.length > 0;

  const diskCache = await readDiskCache();

  const liveDonki: DonkiEventsMap | null = donkiLiveOk
    ? {
        cme: parseDonkiList(cmeRes.data, 'CME'),
        sep: parseDonkiList(sepRes.data, 'SEP'),
        flr: parseDonkiList(flrRes.data, 'FLR'),
        gst: parseDonkiList(gstRes.data, 'GST'),
      }
    : null;

  const resolvedDonki = liveDonki ?? diskCache?.donkiEvents ?? null;
  const resolvedRadLab = radlabLiveOk ? parsedRadLab : diskCache?.radlabRecords ?? null;

  if (liveDonki || radlabLiveOk) {
    const cachePayload: CachedPayload = {
      fetchedAt: new Date().toISOString(),
      donkiRange: { startDate, endDate },
      donkiEvents: resolvedDonki,
      radlabRecords: resolvedRadLab,
    };
    memoryCache = { data: cachePayload, timestamp: Date.now() };
    await writeDiskCache(cachePayload);
  }

  const finalDonki = resolvedDonki ?? buildSimulatedDonkiEvents(startDate);
  const donkiStatus = liveDonki ? ('live' as const) : resolvedDonki ? ('cached' as const) : ('simulated' as const);
  const radlabStatus = radlabLiveOk ? ('live' as const) : resolvedRadLab ? ('cached' as const) : ('simulated' as const);
  const scenarios = selectFeaturedScenarios(finalDonki);

  return {
    donkiStatus,
    radlabStatus,
    fetchedAt: new Date().toISOString(),
    donkiRange: { startDate, endDate },
    donkiEvents: finalDonki,
    radlabRecords: resolvedRadLab ?? [],
    ...scenarios,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'lunarbase-server' });
  });

  app.get('/api/nasa/mission-data', async (req, res) => {
    const refresh = req.query.refresh === '1';
    const data = await getNasaMissionData(refresh);
    res.json(data);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LunarBase server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
