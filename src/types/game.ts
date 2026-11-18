export type MissionPhase = 'title' | 'playing' | 'paused' | 'report';

export type ModuleId = 'habitat' | 'solar' | 'greenhouse' | 'shelter' | 'comms';

export type DataSourceStatus = 'live' | 'cached' | 'simulated';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type RationLevel = 'conserve' | 'standard' | 'high';

export type WaterAllocation = 'balanced' | 'drinking' | 'cultivation';

export type ShelterPosture = 'outdoor' | 'habitat_hold' | 'shelter';

export type EquipmentSystemId = 'solar' | 'battery' | 'water_recycler' | 'oxygen_scrubber';

export interface DonkiCmeAnalysis {
  isMostAccurate?: boolean;
  time21_5?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  halfAngle?: number | null;
  speed?: number | null;
  type?: string | null;
  note?: string | null;
  link?: string | null;
}

export interface DonkiLinkedEvent {
  activityID: string;
}

export interface DonkiEventRecord {
  id: string;
  eventType: 'CME' | 'SEP' | 'FLR' | 'GST';
  startTime: string;
  sourceLocation: string | null;
  instruments: string[];
  note: string | null;
  link: string | null;
  linkedEvents: DonkiLinkedEvent[];
  cmeSpeedKmS: number | null;
  cmeHalfAngle: number | null;
  cmeType: string | null;
  flareClass: string | null;
  kpIndex: number | null;
  rawAnalysis?: DonkiCmeAnalysis | null;
}

export interface RadLabRecord {
  timestamp: string;
  spacecraft: string;
  instrument: string;
  instrument_id: string | null;
  absorbed_dose_rate: number | null; // uGy/hour
  dose_equivalent_rate: number | null; // uSv/hour
  flux: number | null; // cm^-2 sr^-1 s^-1
}

export interface NasaMissionDataset {
  donkiStatus: DataSourceStatus;
  radlabStatus: DataSourceStatus;
  donkiRange: { startDate: string; endDate: string };
  fetchedAt: string;
  donkiEvents: {
    cme: DonkiEventRecord[];
    sep: DonkiEventRecord[];
    flr: DonkiEventRecord[];
    gst: DonkiEventRecord[];
  };
  radlabRecords: RadLabRecord[];
  featuredDay3Scenario: {
    title: string;
    primaryEvent: DonkiEventRecord | null;
    hasConfirmedSep: boolean;
    isSimulationInspired: boolean;
    briefSummary: string;
    scientificNote: string;
  };
  featuredDay5Scenario: {
    title: string;
    primaryEvent: DonkiEventRecord | null;
    hasConfirmedSep: boolean;
    isSimulationInspired: boolean;
    briefSummary: string;
  };
}

export interface EquipmentState {
  id: EquipmentSystemId;
  name: string;
  moduleId: ModuleId;
  condition: number; // 0-100
  failed: boolean;
  failureDescription: string | null;
}

export interface MissionAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  moduleId?: ModuleId;
}

export interface DecisionLogEntry {
  day: number;
  hour: string;
  title: string;
  choice: string;
  consequence: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface FeedbackToast {
  id: string;
  whatChanged: string;
  whyChanged: string;
  nextConsider: string;
  tone: 'good' | 'warn' | 'bad';
}

export interface Day1Checklist {
  habitatInspected: boolean;
  waterChecked: boolean;
  solarActivated: boolean;
  foodAllocated: boolean;
  shelterInspected: boolean;
}

export interface GameState {
  phase: MissionPhase;
  day: number; // 1..5
  shiftHour: number; // 6..22 (in hours, fractional)
  simSpeed: 0 | 1 | 2; // 0 = paused, 1 = normal, 2 = fast

  // Core survival resources (0..100%)
  oxygen: number;
  water: number;
  food: number;
  power: number; // battery charge 0..100%
  crewHealth: number; // 0..100%
  simulatedExposureMSv: number; // cumulative simulated mission dose in mSv (safe < 50, warning 50-120, danger > 120)
  exposureRateMicroSvHr: number; // current simulated lunar exposure rate uSv/hr

  // Subsystem states
  lifeSupportActive: boolean;
  solarActive: boolean;
  greenhouseLightsOn: boolean;
  cropGrowth: number; // 0..100%
  cropCyclesHarvested: number;
  rations: RationLevel;
  waterAllocation: WaterAllocation;
  shelterPosture: ShelterPosture;
  repairKits: number;

  // Equipment condition
  equipment: Record<EquipmentSystemId, EquipmentState>;

  // Progression flags
  day1Checklist: Day1Checklist;
  day2WaterDecided: boolean;
  day3WarningActive: boolean;
  day3ChoiceMade: ShelterPosture | null;
  day4MalfunctionTriggered: boolean;
  day4FirstRepairDone: boolean;
  day5StormActive: boolean;
  day5ChoiceMade: ShelterPosture | null;

  // Selected 3D module & HUD state
  selectedModule: ModuleId | null;
  hoveredModule: ModuleId | null;
  alerts: MissionAlert[];
  lastFeedback: FeedbackToast | null;
  decisionLog: DecisionLogEntry[];
  mistakes: string[];
  successes: string[];
  outcome: 'pending' | 'success' | 'partial' | 'failure';
  outcomeReason: string;
  score: number;
}
