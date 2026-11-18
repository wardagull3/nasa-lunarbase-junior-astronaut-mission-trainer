import {
  AlertTriangle,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Droplets,
  FastForward,
  HeartPulse,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Sprout,
  Sun,
  Utensils,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DAY_GOALS, DAY_TITLES, formatShiftClock, isDay1Complete } from '../game/engine';
import type {
  EquipmentSystemId,
  GameState,
  ModuleId,
  NasaMissionDataset,
  RationLevel,
  ShelterPosture,
  WaterAllocation,
} from '../types/game';

interface MissionHudProps {
  state: GameState;
  nasa: NasaMissionDataset;
  muted: boolean;
  onToggleMute: () => void;
  onSetSpeed: (speed: 0 | 1 | 2) => void;
  onPauseModal: () => void;
  onAdvanceDay: () => void;
  onSelectModule: (moduleId: ModuleId | 'overview' | null) => void;
  onDismissFeedback: () => void;
  onAction: (
    action:
      | { type: 'activate_life_support' }
      | { type: 'check_water_system' }
      | { type: 'activate_solar' }
      | { type: 'set_rations'; rations: RationLevel }
      | { type: 'set_water_allocation'; allocation: WaterAllocation }
      | { type: 'toggle_grow_lights' }
      | { type: 'harvest_crops' }
      | { type: 'inspect_shelter' }
      | { type: 'set_shelter_posture'; posture: ShelterPosture }
      | { type: 'repair_system'; systemId: EquipmentSystemId; emergencyPatch?: boolean },
  ) => void;
}

function MeterChip({
  icon,
  label,
  value,
  unit = '%',
  warnBelow,
  critBelow,
  invertWarn,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  warnBelow: number;
  critBelow: number;
  invertWarn?: boolean;
}) {
  const isCrit = invertWarn ? value >= critBelow : value <= critBelow;
  const isWarn = invertWarn ? !isCrit && value >= warnBelow : !isCrit && value <= warnBelow;
  const tone = isCrit
    ? 'border-rose-500/70 bg-rose-950/85 text-rose-200'
    : isWarn
      ? 'border-amber-500/70 bg-amber-950/85 text-amber-200'
      : 'border-slate-700/80 bg-slate-900/90 text-slate-100';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${tone}`}>
      <span className="shrink-0">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] text-slate-400 whitespace-nowrap">{label}</div>
        <div className="font-mono font-semibold tabular-nums whitespace-nowrap">
          {unit === 'mSv' ? value.toFixed(1) : Math.round(value)}
          <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function MissionHud({
  state,
  nasa,
  muted,
  onToggleMute,
  onSetSpeed,
  onPauseModal,
  onAdvanceDay,
  onSelectModule,
  onDismissFeedback,
  onAction,
}: MissionHudProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const day1Ready = state.day === 1 && isDay1Complete(state);
  const dayReadyToAdvance =
    day1Ready ||
    (state.day === 2 && state.day2WaterDecided && state.shiftHour >= 14) ||
    (state.day === 3 && state.day3ChoiceMade !== null && state.shiftHour >= 15) ||
    (state.day === 4 && state.day4FirstRepairDone && state.shiftHour >= 15) ||
    (state.day === 5 && state.day5ChoiceMade !== null && state.shiftHour >= 17);

  const modules: Array<{ id: ModuleId; label: string; alert?: boolean }> = [
    {
      id: 'habitat',
      label: 'Habitat',
      alert:
        !state.lifeSupportActive ||
        state.oxygen < 30 ||
        state.water < 28 ||
        state.equipment.water_recycler.failed ||
        state.equipment.oxygen_scrubber.failed,
    },
    {
      id: 'solar',
      label: 'Solar',
      alert: !state.solarActive || state.power < 24 || state.equipment.solar.failed || state.equipment.battery.failed,
    },
    {
      id: 'greenhouse',
      label: 'Greenhouse',
      alert: state.cropGrowth >= 99 || state.food < 25,
    },
    {
      id: 'shelter',
      label: 'Shelter',
      alert: state.day3WarningActive || state.day5StormActive,
    },
    {
      id: 'comms',
      label: 'NASA Data',
    },
  ];

  const radLabSample = nasa.radlabRecords[0] ?? null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* Top Perimeter Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* Mission Day & Clock Cluster */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-[#0B0F19]/92 border border-slate-700/80">
            <div>
              <div className="text-xs font-semibold text-cyan-300 whitespace-nowrap">
                {DAY_TITLES[state.day]}
              </div>
              <div className="text-[11px] text-slate-400 max-w-md truncate">
                {DAY_GOALS[state.day]}
              </div>
            </div>

            <div className="h-7 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-white tabular-nums">
                {formatShiftClock(state.shiftHour)}
              </span>
              <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => onSetSpeed(0)}
                  aria-label="Pause simulation"
                  className={`px-2 py-1 rounded text-xs cursor-pointer ${
                    state.simSpeed === 0 ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetSpeed(1)}
                  aria-label="Normal simulation speed"
                  className={`px-2 py-1 rounded text-xs font-mono cursor-pointer ${
                    state.simSpeed === 1 ? 'bg-cyan-400 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  1x
                </button>
                <button
                  type="button"
                  onClick={() => onSetSpeed(2)}
                  aria-label="Fast simulation speed"
                  className={`px-2 py-1 rounded text-xs font-mono cursor-pointer inline-flex items-center gap-0.5 ${
                    state.simSpeed === 2 ? 'bg-cyan-400 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <FastForward className="w-3 h-3" />
                  2x
                </button>
              </div>
              {dayReadyToAdvance && (
                <button
                  type="button"
                  onClick={onAdvanceDay}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {state.day < 5 ? `Next Day (${state.day + 1})` : 'Finish Mission'}
                </button>
              )}
            </div>
          </div>

          {/* Resource Meters Cluster */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            <MeterChip
              icon={<Wind className="w-3.5 h-3.5 text-cyan-400" />}
              label="Oxygen"
              value={state.oxygen}
              warnBelow={32}
              critBelow={18}
            />
            <MeterChip
              icon={<Droplets className="w-3.5 h-3.5 text-sky-400" />}
              label="Water"
              value={state.water}
              warnBelow={30}
              critBelow={16}
            />
            <MeterChip
              icon={<Utensils className="w-3.5 h-3.5 text-emerald-400" />}
              label="Food"
              value={state.food}
              warnBelow={28}
              critBelow={14}
            />
            <MeterChip
              icon={<BatteryCharging className="w-3.5 h-3.5 text-amber-400" />}
              label="Power"
              value={state.power}
              warnBelow={26}
              critBelow={12}
            />
            <MeterChip
              icon={<HeartPulse className="w-3.5 h-3.5 text-rose-400" />}
              label="Health"
              value={state.crewHealth}
              warnBelow={55}
              critBelow={30}
            />
            <MeterChip
              icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-300" />}
              label="Sim Dose"
              value={state.simulatedExposureMSv}
              unit="mSv"
              warnBelow={60}
              critBelow={100}
              invertWarn
            />

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-lg bg-[#0B0F19]/92 border border-slate-700/80 text-slate-300 hover:text-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              type="button"
              onClick={onPauseModal}
              className="px-3 py-2 rounded-lg bg-[#0B0F19]/92 border border-slate-700/80 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              Menu
            </button>
          </div>
        </div>

        {/* Active Alerts + Feedback Row (never covers center playfield) */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {state.alerts.slice(0, 2).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => alert.moduleId && onSelectModule(alert.moduleId)}
                className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs text-left cursor-pointer transition-colors ${
                  alert.severity === 'critical'
                    ? 'bg-rose-950/92 border-rose-500/80 text-rose-100 hover:bg-rose-900/90'
                    : 'bg-amber-950/92 border-amber-500/80 text-amber-100 hover:bg-amber-900/90'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong className="font-semibold">{alert.title}:</strong> {alert.message}
                </span>
              </button>
            ))}
          </div>

          {state.lastFeedback && (
            <div
              className={`pointer-events-auto max-w-md flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs ${
                state.lastFeedback.tone === 'bad'
                  ? 'bg-rose-950/92 border-rose-600/70 text-rose-100'
                  : state.lastFeedback.tone === 'warn'
                    ? 'bg-amber-950/92 border-amber-600/70 text-amber-100'
                    : 'bg-[#0B0F19]/92 border-cyan-500/50 text-slate-100'
              }`}
            >
              <div className="space-y-0.5 flex-1">
                <div className="font-semibold text-white">{state.lastFeedback.whatChanged}</div>
                <div className="text-slate-300">{state.lastFeedback.whyChanged}</div>
                <div className="text-[11px] text-cyan-300">Next: {state.lastFeedback.nextConsider}</div>
              </div>
              <button
                type="button"
                onClick={onDismissFeedback}
                aria-label="Dismiss feedback"
                className="text-slate-400 hover:text-white cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Collapsible Control Dock */}
      <div className="flex flex-col items-center w-full">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0B0F19]/92 border border-b-0 border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[940px] rounded-xl bg-[#0B0F19]/94 border border-slate-700/80 p-3 space-y-3 shadow-2xl">
            {/* Module Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectModule('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    state.selectedModule === null
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Base Overview
                </button>
                {modules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectModule(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      state.selectedModule === m.id
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : m.alert
                          ? 'bg-amber-950/90 border border-amber-500/70 text-amber-200 hover:bg-amber-900'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{m.label}</span>
                    {m.alert && <AlertTriangle className="w-3 h-3 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                Kits: {state.repairKits} · Crew: {state.shelterPosture === 'shelter' ? 'In Shelter' : state.shelterPosture === 'habitat_hold' ? 'In Habitat' : 'Outdoor Ops'}
              </div>
            </div>

            {/* Active Module Action Panel (inside bottom dock, zero center occlusion) */}
            {state.selectedModule === null && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                {state.day === 1 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-white">Day 1 Setup:</span>
                    <span className={state.day1Checklist.habitatInspected ? 'text-emerald-400' : 'text-slate-400'}>
                      {state.day1Checklist.habitatInspected ? '✓' : '○'} Life Support
                    </span>
                    <span className={state.day1Checklist.waterChecked ? 'text-emerald-400' : 'text-slate-400'}>
                      {state.day1Checklist.waterChecked ? '✓' : '○'} Water Loop
                    </span>
                    <span className={state.day1Checklist.solarActivated ? 'text-emerald-400' : 'text-slate-400'}>
                      {state.day1Checklist.solarActivated ? '✓' : '○'} Solar Power
                    </span>
                    <span className={state.day1Checklist.foodAllocated ? 'text-emerald-400' : 'text-slate-400'}>
                      {state.day1Checklist.foodAllocated ? '✓' : '○'} Food Rations
                    </span>
                    <span className={state.day1Checklist.shelterInspected ? 'text-emerald-400' : 'text-slate-400'}>
                      {state.day1Checklist.shelterInspected ? '✓' : '○'} Shelter Check
                    </span>
                  </div>
                ) : (
                  <span>Click any 3D building or tab above to operate base systems, grow crops, repair faults, or shelter the crew.</span>
                )}
              </div>
            )}

            {state.selectedModule === 'habitat' && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Life Support & Water Loop</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'activate_life_support' })}
                      className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                        state.lifeSupportActive
                          ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300'
                          : 'bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300'
                      }`}
                    >
                      {state.lifeSupportActive ? 'Life Support Active' : 'Activate Life Support'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'check_water_system' })}
                      className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                        state.day1Checklist.waterChecked
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300'
                      }`}
                    >
                      {state.day1Checklist.waterChecked ? 'Prime Water Loop' : 'Check & Prime Water'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Daily Crew Food Rations</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['conserve', 'standard', 'high'] as RationLevel[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onAction({ type: 'set_rations', rations: r })}
                        className={`px-2.5 py-1.5 rounded-lg capitalize cursor-pointer whitespace-nowrap ${
                          state.rations === r
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Habitat Hardware</span>
                  </div>
                  {(['water_recycler', 'oxygen_scrubber'] as EquipmentSystemId[]).map((id) => {
                    const eq = state.equipment[id];
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className={eq.failed ? 'text-rose-300 font-medium' : 'text-slate-300'}>
                          {eq.name} ({Math.round(eq.condition)}%)
                        </span>
                        {eq.failed && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={state.repairKits <= 0}
                              onClick={() => onAction({ type: 'repair_system', systemId: id })}
                              className="px-2 py-1 rounded bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer"
                            >
                              Kit
                            </button>
                            <button
                              type="button"
                              disabled={state.power < 15}
                              onClick={() => onAction({ type: 'repair_system', systemId: id, emergencyPatch: true })}
                              className="px-2 py-1 rounded bg-amber-500 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer"
                            >
                              Patch
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {state.selectedModule === 'solar' && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Photovoltaic Array & Battery Bank</span>
                  </div>
                  <p className="text-slate-300">
                    Solar panels charge base batteries during lunar daylight. Power drops if grow lights, shelter, and life support exceed generation.
                  </p>
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'activate_solar' })}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                      state.solarActive
                        ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300'
                        : 'bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300'
                    }`}
                  >
                    {state.solarActive ? 'Solar Trackers Online' : 'Activate Solar Panels'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Power Equipment Condition</span>
                  </div>
                  {(['solar', 'battery'] as EquipmentSystemId[]).map((id) => {
                    const eq = state.equipment[id];
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <div>
                          <div className={eq.failed ? 'text-rose-300 font-semibold' : 'text-slate-200'}>
                            {eq.name} · {Math.round(eq.condition)}%
                          </div>
                          {eq.failureDescription && (
                            <div className="text-[11px] text-rose-400">{eq.failureDescription}</div>
                          )}
                        </div>
                        {eq.failed && (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={state.repairKits <= 0}
                              onClick={() => onAction({ type: 'repair_system', systemId: id })}
                              className="px-2.5 py-1 rounded bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer"
                            >
                              Repair (1 Kit)
                            </button>
                            <button
                              type="button"
                              disabled={state.power < 15}
                              onClick={() => onAction({ type: 'repair_system', systemId: id, emergencyPatch: true })}
                              className="px-2.5 py-1 rounded bg-amber-500 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer"
                            >
                              Patch (-14% Pwr)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {state.selectedModule === 'greenhouse' && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" />
                    <span>Water Allocation Mode</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['drinking', 'Drinking First'],
                        ['balanced', 'Balanced'],
                        ['cultivation', 'Grow Crops'],
                      ] as Array<[WaterAllocation, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onAction({ type: 'set_water_allocation', allocation: mode })}
                        className={`px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ${
                          state.waterAllocation === mode
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Crop Growth ({Math.round(state.cropGrowth)}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${Math.min(100, state.cropGrowth)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Harvests completed: {state.cropCyclesHarvested} · Requires time, water & grow lights
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'toggle_grow_lights' })}
                    className={`px-3 py-2 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                      state.greenhouseLightsOn
                        ? 'bg-fuchsia-500/25 border border-fuchsia-400/70 text-fuchsia-200'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {state.greenhouseLightsOn ? 'Grow Lights: ON' : 'Grow Lights: OFF'}
                  </button>
                  <button
                    type="button"
                    disabled={state.cropGrowth < 99}
                    onClick={() => onAction({ type: 'harvest_crops' })}
                    className="px-3 py-2 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 cursor-pointer whitespace-nowrap"
                  >
                    Harvest Crops (+24% Food)
                  </button>
                </div>
              </div>
            )}

            {state.selectedModule === 'shelter' && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Radiation Shelter & Crew Posture</span>
                  </div>
                  <p className="text-slate-300">
                    {state.day === 3
                      ? nasa.featuredDay3Scenario.briefSummary
                      : state.day === 5
                        ? nasa.featuredDay5Scenario.briefSummary
                        : 'Regolith shielding reduces simulated solar particle dose, while consuming shelter battery power.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {state.day === 1 && !state.day1Checklist.shelterInspected && (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'inspect_shelter' })}
                        className="px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300 cursor-pointer"
                      >
                        Verify Shelter Readiness
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'set_shelter_posture', posture: 'shelter' })}
                      className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                        state.shelterPosture === 'shelter'
                          ? 'bg-emerald-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      Enter Shelter (-Pwr, Low Dose)
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'set_shelter_posture', posture: 'habitat_hold' })}
                      className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                        state.shelterPosture === 'habitat_hold'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      Delay Outdoors (In Habitat)
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'set_shelter_posture', posture: 'outdoor' })}
                      className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                        state.shelterPosture === 'outdoor'
                          ? 'bg-rose-500 text-white font-semibold'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      Continue Outdoor Work
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Simulated Lunar Exposure vs NASA ISS Reference</span>
                    <span className="font-mono text-amber-300 tabular-nums">
                      Sim Rate: {state.exposureRateMicroSvHr} μSv/h
                    </span>
                  </div>
                  {radLabSample ? (
                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <div>
                        <strong className="text-cyan-300">NASA Measurement ({radLabSample.spacecraft} / {radLabSample.instrument}):</strong>{' '}
                        {radLabSample.absorbed_dose_rate?.toFixed(2) ?? 'N/A'} μGy/h absorbed ·{' '}
                        {radLabSample.flux?.toFixed(3) ?? 'N/A'} cm⁻²sr⁻¹s⁻¹ flux
                      </div>
                      <div className="text-slate-400">
                        Note: ISS reference measurements come from Low Earth Orbit, not the lunar surface.
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Educational radiation simulation active (NASA RadLab reference unavailable).
                    </div>
                  )}
                </div>
              </div>
            )}

            {state.selectedModule === 'comms' && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>NASA DONKI Space Weather ({nasa.donkiStatus})</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {nasa.donkiRange.startDate} to {nasa.donkiRange.endDate}
                    </span>
                  </div>
                  <div className="text-slate-300 font-mono text-[11px]">
                    CME: {nasa.donkiEvents.cme.length} · SEP: {nasa.donkiEvents.sep.length} · FLR: {nasa.donkiEvents.flr.length} · GST: {nasa.donkiEvents.gst.length}
                  </div>
                  {nasa.featuredDay3Scenario.primaryEvent && (
                    <div className="text-[11px] text-slate-300">
                      Featured Event: <span className="text-cyan-300 font-mono">{nasa.featuredDay3Scenario.primaryEvent.id}</span>
                      {nasa.featuredDay3Scenario.primaryEvent.cmeSpeedKmS
                        ? ` · Speed ${Math.round(nasa.featuredDay3Scenario.primaryEvent.cmeSpeedKmS)} km/s`
                        : ''}
                      {nasa.featuredDay3Scenario.primaryEvent.sourceLocation
                        ? ` · Source ${nasa.featuredDay3Scenario.primaryEvent.sourceLocation}`
                        : ''}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>NASA OSDR RadLab ({nasa.radlabStatus})</span>
                    <span className="font-mono text-[11px] text-slate-400">ISS Reference</span>
                  </div>
                  {radLabSample ? (
                    <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                      <div>
                        {radLabSample.spacecraft} · {radLabSample.instrument_id || radLabSample.instrument} · {radLabSample.timestamp}
                      </div>
                      <div>
                        Absorbed: {radLabSample.absorbed_dose_rate?.toFixed(2) ?? 'N/A'} μGy/h · Dose Eq:{' '}
                        {radLabSample.dose_equivalent_rate !== null
                          ? `${radLabSample.dose_equivalent_rate.toFixed(2)} μSv/h`
                          : 'N/A'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Simulation mode — live RadLab measurements unavailable.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
