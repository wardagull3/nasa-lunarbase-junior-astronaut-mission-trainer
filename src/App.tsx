import { Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { LunarSceneCanvas } from './components/LunarSceneCanvas';
import { MissionHud } from './components/MissionHud';
import { MissionReport } from './components/MissionReport';
import { TitleScreen } from './components/TitleScreen';
import {
  advanceToNextDay,
  applyModuleAction,
  createInitialGameState,
  stepSimulation,
} from './game/engine';
import { loadNasaMissionDataset } from './services/nasaClient';
import type { GameState, ModuleId, NasaMissionDataset } from './types/game';

const INITIAL_NASA: NasaMissionDataset = {
  donkiStatus: 'simulated',
  radlabStatus: 'simulated',
  donkiRange: { startDate: '2026-11-01', endDate: '2026-11-15' },
  fetchedAt: '',
  donkiEvents: { cme: [], sep: [], flr: [], gst: [] },
  radlabRecords: [],
  featuredDay3Scenario: {
    title: 'Loading Space-Weather Data',
    primaryEvent: null,
    hasConfirmedSep: false,
    isSimulationInspired: true,
    briefSummary: 'Fetching NASA DONKI space-weather events and OSDR RadLab measurements.',
    scientificNote: '',
  },
  featuredDay5Scenario: {
    title: 'Loading Space-Weather Data',
    primaryEvent: null,
    hasConfirmedSep: false,
    isSimulationInspired: true,
    briefSummary: '',
  },
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [nasaData, setNasaData] = useState<NasaMissionDataset>(INITIAL_NASA);
  const [muted, setMuted] = useState(false);

  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const nasaRef = useRef<NasaMissionDataset>(nasaData);
  nasaRef.current = nasaData;

  const focusRequestRef = useRef<ModuleId | 'overview' | null>(null);

  useEffect(() => {
    let active = true;
    loadNasaMissionDataset().then((data) => {
      if (active) setNasaData(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Fixed-interval simulation ticker (syncs cleanly without tearing down 3D canvas)
  useEffect(() => {
    const id = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.phase !== 'playing' || prev.simSpeed === 0) return prev;
        const next = stepSimulation(prev, 0.25, nasaRef.current);
        if (next.day !== prev.day) {
          soundEngine.playDayAdvance();
        } else if (
          (next.day3WarningActive && !prev.day3WarningActive) ||
          (next.day4MalfunctionTriggered && !prev.day4MalfunctionTriggered) ||
          (next.day5StormActive && !prev.day5StormActive)
        ) {
          soundEngine.playAlert();
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const handleStart = useCallback(() => {
    soundEngine.playConfirm();
    focusRequestRef.current = 'overview';
    setGameState(() => ({
      ...createInitialGameState(),
      phase: 'playing',
    }));
  }, []);

  const handleRestart = useCallback(() => {
    soundEngine.playConfirm();
    focusRequestRef.current = 'overview';
    setGameState(() => ({
      ...createInitialGameState(),
      phase: 'playing',
    }));
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    setMuted(next);
  }, []);

  const handleSelectModule = useCallback((target: ModuleId | 'overview' | null) => {
    soundEngine.playClick();
    if (target === 'overview' || target === null) {
      focusRequestRef.current = 'overview';
      setGameState((prev) => applyModuleAction(prev, { type: 'select_module', moduleId: null }));
    } else {
      focusRequestRef.current = target;
      setGameState((prev) => applyModuleAction(prev, { type: 'select_module', moduleId: target }));
    }
  }, []);

  const handleHoverModule = useCallback((moduleId: ModuleId | null) => {
    setGameState((prev) => (prev.hoveredModule === moduleId ? prev : { ...prev, hoveredModule: moduleId }));
  }, []);

  // Keyboard shortcuts (Enter/Space on Title, Esc/Space to Pause, H handled in HUD)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const phase = gameStateRef.current.phase;
      if (phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStart();
      } else if (phase === 'playing' && e.key === 'Escape') {
        e.preventDefault();
        setGameState((p) => ({ ...p, phase: 'paused' }));
      } else if (phase === 'paused' && e.key === 'Escape') {
        e.preventDefault();
        setGameState((p) => ({ ...p, phase: 'playing' }));
      } else if (phase === 'playing' && e.key === ' ') {
        e.preventDefault();
        setGameState((p) => ({ ...p, simSpeed: p.simSpeed === 0 ? 1 : 0 }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStart]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090E] select-none">
      {/* Isolated 3D WebGL Viewport */}
      <LunarSceneCanvas
        gameStateRef={gameStateRef}
        onSelectModule={(m) => handleSelectModule(m)}
        onHoverModule={handleHoverModule}
        focusRequestRef={focusRequestRef}
      />

      {gameState.phase === 'title' && (
        <TitleScreen
          onStart={handleStart}
          donkiStatus={nasaData.donkiStatus}
          radlabStatus={nasaData.radlabStatus}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {(gameState.phase === 'playing' || gameState.phase === 'paused') && (
        <MissionHud
          state={gameState}
          nasa={nasaData}
          muted={muted}
          onToggleMute={handleToggleMute}
          onSetSpeed={(speed) => {
            soundEngine.playClick();
            setGameState((p) => ({ ...p, simSpeed: speed }));
          }}
          onPauseModal={() => {
            soundEngine.playClick();
            setGameState((p) => ({ ...p, phase: 'paused' }));
          }}
          onAdvanceDay={() => {
            soundEngine.playDayAdvance();
            setGameState((p) => advanceToNextDay(p));
          }}
          onSelectModule={handleSelectModule}
          onDismissFeedback={() => setGameState((p) => ({ ...p, lastFeedback: null }))}
          onAction={(action) => {
            if (action.type === 'repair_system') soundEngine.playRepair();
            else soundEngine.playConfirm();
            setGameState((p) => applyModuleAction(p, action));
          }}
        />
      )}

      {/* Pause Modal */}
      {gameState.phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#07090E]/85 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#0B0F19] border border-slate-700 p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h2
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Mission Paused
              </h2>
              <p className="text-xs text-slate-400">
                Day {gameState.day} of 5 · Crew Health {Math.round(gameState.crewHealth)}%
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGameState((p) => ({ ...p, phase: 'playing' }))}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Mission</span>
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Mission</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState.phase === 'report' && (
        <MissionReport state={gameState} nasa={nasaData} onRestart={handleRestart} />
      )}
    </div>
  );
}
