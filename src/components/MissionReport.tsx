import { ChevronDown, ChevronUp, ExternalLink, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { GameState, NasaMissionDataset } from '../types/game';

interface MissionReportProps {
  state: GameState;
  nasa: NasaMissionDataset;
  onRestart: () => void;
}

export function MissionReport({ state, nasa, onRestart }: MissionReportProps) {
  const [scienceOpen, setScienceOpen] = useState(false);

  const statusHeading =
    state.outcome === 'success'
      ? 'Mission Successful'
      : state.outcome === 'partial'
        ? 'Partial Success'
        : 'Mission Failed';

  const statusColor =
    state.outcome === 'success'
      ? 'text-emerald-400'
      : state.outcome === 'partial'
        ? 'text-amber-400'
        : 'text-rose-400';

  const donkiLabel =
    nasa.donkiStatus === 'live'
      ? 'NASA data retrieved successfully'
      : nasa.donkiStatus === 'cached'
        ? 'NASA data loaded from cache'
        : 'Simulation mode — NASA data unavailable';

  const radlabLabel =
    nasa.radlabStatus === 'live'
      ? 'NASA data retrieved successfully'
      : nasa.radlabStatus === 'cached'
        ? 'NASA data loaded from cache'
        : 'Simulation mode — NASA data unavailable';

  const sampleDonki = [
    ...nasa.donkiEvents.sep.slice(0, 2),
    ...nasa.donkiEvents.cme.slice(0, 3),
    ...nasa.donkiEvents.flr.slice(0, 2),
    ...nasa.donkiEvents.gst.slice(0, 2),
  ];

  const sampleRadlab = nasa.radlabRecords.slice(0, 4);

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-[#07090E]/96 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Summary Header */}
        <div className="rounded-xl bg-[#0B0F19] border border-slate-800 p-6 md:p-8 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className={`text-sm font-semibold ${statusColor}`}>{statusHeading}</div>
              <h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
              >
                {state.outcomeReason}
              </h1>
              <p className="text-xs font-mono text-slate-400">
                Mission Completed on Day {state.day} · Crew Survival:{' '}
                {state.crewHealth > 0 ? 'All Crew Alive' : 'Crew Lost'}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Mission Score</div>
              <div className="text-3xl font-mono font-bold text-cyan-300 tabular-nums">
                {state.score}
              </div>
            </div>
          </div>

          {/* Final Resource Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-slate-800">
            {[
              ['Oxygen', `${Math.round(state.oxygen)}%`],
              ['Water', `${Math.round(state.water)}%`],
              ['Food', `${Math.round(state.food)}%`],
              ['Power', `${Math.round(state.power)}%`],
              ['Crew Health', `${Math.round(state.crewHealth)}%`],
              ['Sim Dose', `${state.simulatedExposureMSv.toFixed(1)} mSv`],
            ].map(([label, val]) => (
              <div key={label} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400">{label}</div>
                <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Successes & Mistakes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-emerald-300">Successful Actions</h2>
              {state.successes.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {Array.from(new Set(state.successes)).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No major milestone completions recorded.</p>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-300">Areas to Improve</h2>
              {state.mistakes.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {Array.from(new Set(state.mistakes)).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Zero critical operational mistakes recorded.</p>
              )}
            </div>
          </div>

          {/* Decision Log */}
          {state.decisionLog.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h2 className="text-sm font-semibold text-white">Commander Decision Log</h2>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {state.decisionLog.map((d, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-xs py-1.5 border-b border-slate-800/70"
                  >
                    <div>
                      <span className="font-mono text-slate-400 mr-2">
                        D{d.day} {d.hour}
                      </span>
                      <span className="font-medium text-white">{d.choice}</span>
                    </div>
                    <span className="text-slate-400">{d.consequence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart 5-Day Mission</span>
            </button>

            <button
              type="button"
              onClick={() => setScienceOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm cursor-pointer transition-colors border border-slate-700"
            >
              <span>Explore the Science Behind Your Mission</span>
              {scienceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Optional Science Debrief */}
        {scienceOpen && (
          <div className="rounded-xl bg-[#0B0F19] border border-slate-800 p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h2
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Explore the Science Behind Your Mission
              </h2>
              <p className="text-xs text-slate-400">
                LunarBase uses real NASA space-weather and dosimetry records as scientific references, while the lunar base, resource loops, and crew radiation exposure outcomes are simulated for learning.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Coronal Mass Ejection (CME)</h3>
                <p>
                  A massive cloud of magnetized solar plasma hurled outward from the Sun. Fast CMEs can drive shock waves, though a CME alone does not automatically cause dangerous particle radiation on the Moon.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Solar Flare (FLR)</h3>
                <p>
                  A sudden flash of intense light and X-rays from the Sun’s surface. Flares travel at the speed of light (~8 minutes to reach Earth/Moon) and are distinct from slower plasma CMEs.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Solar Energetic Particles (SEP)</h3>
                <p>
                  High-energy protons and ions accelerated by solar flares or CME shocks. Because the Moon lacks a global magnetic field and thick atmosphere, SEPs are a primary radiation hazard for lunar astronauts.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Why Radiation Protection Matters</h3>
                <p>
                  Earth’s atmosphere and magnetosphere shield us from most space radiation. On the Moon, dense materials such as lunar regolith soil or water walls absorb incoming particles inside a shelter.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Absorbed Dose Rate vs Dose Equivalent Rate</h3>
                <p>
                  <strong>Absorbed dose rate (μGy/hour)</strong> measures raw radiation energy deposited per kilogram of matter. <strong>Dose equivalent rate (μSv/hour)</strong> weights that energy by how strongly different particle types affect biological tissue.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1.5">
                <h3 className="font-semibold text-cyan-300 text-sm">Closed-Loop Lunar Survival</h3>
                <p>
                  Resupply from Earth is costly, so lunar bases recycle cabin air (O2), recover wastewater, grow plants for food and oxygen, and rely on solar arrays + batteries for uninterrupted life support.
                </p>
              </div>
            </div>

            {/* Real NASA Data Reference Records */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <h3 className="text-sm font-semibold text-white">NASA Records Used in This Mission</h3>
                <div className="font-mono text-slate-400">
                  DONKI: {donkiLabel} · RadLab: {radlabLabel}
                </div>
              </div>

              {sampleDonki.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-300">
                    DONKI Event Records ({nasa.donkiRange.startDate} to {nasa.donkiRange.endDate})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {sampleDonki.map((ev) => (
                      <div key={ev.id} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-cyan-300">{ev.id}</span>
                          <span className="font-mono text-slate-400">{ev.eventType}</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          Time: {ev.startTime || 'N/A'}
                          {ev.sourceLocation ? ` · Source: ${ev.sourceLocation}` : ''}
                          {ev.cmeSpeedKmS ? ` · Speed: ${Math.round(ev.cmeSpeedKmS)} km/s` : ''}
                        </div>
                        {ev.instruments.length > 0 && (
                          <div className="text-[11px] text-slate-400 truncate">
                            Instruments: {ev.instruments.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sampleRadlab.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-300">
                    OSDR RadLab Reference Measurements (Low Earth Orbit — ISS, not Lunar Surface)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-3">Timestamp</th>
                          <th className="py-2 pr-3">Spacecraft / Instrument</th>
                          <th className="py-2 pr-3">Absorbed (μGy/h)</th>
                          <th className="py-2 pr-3">Dose Eq (μSv/h)</th>
                          <th className="py-2">Flux (cm⁻²sr⁻¹s⁻¹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRadlab.map((r, i) => (
                          <tr key={i} className="border-b border-slate-800/60 text-slate-200 tabular-nums">
                            <td className="py-1.5 pr-3">{r.timestamp}</td>
                            <td className="py-1.5 pr-3">{r.spacecraft} / {r.instrument_id || r.instrument}</td>
                            <td className="py-1.5 pr-3">{r.absorbed_dose_rate?.toFixed(3) ?? 'N/A'}</td>
                            <td className="py-1.5 pr-3">{r.dose_equivalent_rate?.toFixed(3) ?? 'N/A'}</td>
                            <td className="py-1.5">{r.flux?.toFixed(4) ?? 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Mandatory NASA Attributions */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Space-weather event data: NASA Community Coordinated Modeling Center (CCMC), Space Weather Database of Notifications, Knowledge, Information (DONKI).
                  </span>
                  <a
                    href="https://ccmc.gsfc.nasa.gov/tools/DONKI/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline"
                  >
                    <span>DONKI Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Radiation reference data: NASA Open Science Data Repository (OSDR), RadLab.
                  </span>
                  <a
                    href="https://visualization.osdr.nasa.gov/radlab/gui/data-api/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline"
                  >
                    <span>RadLab API Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
