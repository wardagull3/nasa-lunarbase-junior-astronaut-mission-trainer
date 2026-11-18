import { Play, Volume2, VolumeX } from 'lucide-react';
import type { DataSourceStatus } from '../types/game';

interface TitleScreenProps {
  onStart: () => void;
  donkiStatus: DataSourceStatus;
  radlabStatus: DataSourceStatus;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({
  onStart,
  donkiStatus,
  radlabStatus,
  muted,
  onToggleMute,
}: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-r from-[#07090E]/90 via-[#07090E]/55 to-transparent">
      {/* Top minimal utility */}
      <div className="flex items-center justify-between">
        <div className="pointer-events-auto text-xs font-mono text-slate-400 tracking-wide">
          NASA DONKI: {donkiStatus} · OSDR RadLab: {radlabStatus}
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900/90 border border-slate-700/80 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          <span>{muted ? 'Sound Off' : 'Sound On'}</span>
        </button>
      </div>

      {/* Hero Lockup over calm left negative space */}
      <div className="max-w-xl space-y-6 my-auto pointer-events-auto">
        <div className="space-y-3">
          {/* Bespoke inline SVG Title Lockup */}
          <svg
            viewBox="0 0 460 88"
            className="w-full max-w-[440px] h-auto"
            role="img"
            aria-label="LunarBase: Junior Astronaut Mission Trainer"
          >
            <g fill="none" stroke="none">
              <circle cx="38" cy="44" r="28" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
              <path
                d="M46 21 A24 24 0 1 0 58 58 A19 19 0 1 1 46 21 Z"
                fill="#f8fafc"
              />
              <path
                d="M12 58 Q38 14 70 28"
                stroke="#f59e0b"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="68" cy="28" r="3.5" fill="#f59e0b" />
            </g>
            <text
              x="86"
              y="46"
              fill="#f8fafc"
              fontFamily="'Chakra Petch', sans-serif"
              fontSize="38"
              fontWeight="700"
              letterSpacing="2"
            >
              LUNARBASE
            </text>
            <text
              x="88"
              y="72"
              fill="#38bdf8"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              fontSize="14"
              fontWeight="600"
              letterSpacing="1.2"
            >
              JUNIOR ASTRONAUT MISSION TRAINER
            </text>
          </svg>

          <h1
            className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
          >
            Could you keep your crew alive on the Moon?
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-md">
            Command a five-day lunar research outpost. Balance oxygen, water, crops, battery power, and solar radiation shelter using real NASA space-weather and radiation reference records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm md:text-base font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer shadow-lg shadow-cyan-500/20 whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start 5-Day Mission</span>
          </button>
          <span className="text-xs font-mono text-slate-400">
            Press Enter or Space to begin
          </span>
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="text-xs font-mono text-slate-400 tracking-wide">
        Click Modules to Operate · Drag to Orbit · Scroll to Zoom · Space Pause · H Toggle Controls
      </div>
    </div>
  );
}
