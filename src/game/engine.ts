import type {
  EquipmentSystemId,
  GameState,
  MissionAlert,
  ModuleId,
  NasaMissionDataset,
  RationLevel,
  ShelterPosture,
  WaterAllocation,
} from '../types/game';

export const DAY_TITLES: Record<number, string> = {
  1: 'Day 1 · Establish the Lunar Base',
  2: 'Day 2 · Water & Food Management',
  3: 'Day 3 · Solar Activity & Radiation Warning',
  4: 'Day 4 · Equipment Failure',
  5: 'Day 5 · Final Survival Test',
};

export const DAY_GOALS: Record<number, string> = {
  1: 'Click each base module to inspect life support, activate solar power, allocate food, and check the shelter.',
  2: 'Balance water between drinking, hygiene, and greenhouse plants while managing grow-light electricity.',
  3: 'Respond to the space-weather warning—protect your crew from simulated radiation without draining vital power.',
  4: 'Inspect malfunctioning equipment and decide what to repair first with your limited repair kits.',
  5: 'Survive the final shift by managing oxygen, water, food, power, repairs, and the late-mission storm.',
};

export function formatShiftClock(shiftHour: number): string {
  const whole = Math.floor(shiftHour);
  const mins = Math.floor((shiftHour - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    day: 1,
    shiftHour: 6.0,
    simSpeed: 1,

    oxygen: 84,
    water: 82,
    food: 80,
    power: 78,
    crewHealth: 96,
    simulatedExposureMSv: 1.8,
    exposureRateMicroSvHr: 28,

    lifeSupportActive: false,
    solarActive: false,
    greenhouseLightsOn: false,
    cropGrowth: 15,
    cropCyclesHarvested: 0,
    rations: 'standard',
    waterAllocation: 'balanced',
    shelterPosture: 'outdoor',
    repairKits: 2,

    equipment: {
      solar: {
        id: 'solar',
        name: 'Solar Gimbal Array',
        moduleId: 'solar',
        condition: 96,
        failed: false,
        failureDescription: null,
      },
      battery: {
        id: 'battery',
        name: 'Battery Bank',
        moduleId: 'solar',
        condition: 94,
        failed: false,
        failureDescription: null,
      },
      water_recycler: {
        id: 'water_recycler',
        name: 'Water Recovery Loop',
        moduleId: 'habitat',
        condition: 95,
        failed: false,
        failureDescription: null,
      },
      oxygen_scrubber: {
        id: 'oxygen_scrubber',
        name: 'CO2 & O2 Scrubber',
        moduleId: 'habitat',
        condition: 96,
        failed: false,
        failureDescription: null,
      },
    },

    day1Checklist: {
      habitatInspected: false,
      waterChecked: false,
      solarActivated: false,
      foodAllocated: false,
      shelterInspected: false,
    },
    day2WaterDecided: false,
    day3WarningActive: false,
    day3ChoiceMade: null,
    day4MalfunctionTriggered: false,
    day4FirstRepairDone: false,
    day5StormActive: false,
    day5ChoiceMade: null,

    selectedModule: null,
    hoveredModule: null,
    alerts: [],
    lastFeedback: null,
    decisionLog: [],
    mistakes: [],
    successes: [],
    outcome: 'pending',
    outcomeReason: '',
    score: 0,
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function computeAlerts(state: GameState): MissionAlert[] {
  const alerts: MissionAlert[] = [];
  if (state.day3WarningActive || state.day5StormActive) {
    alerts.push({
      id: 'rad-warning',
      severity: state.shelterPosture === 'outdoor' ? 'critical' : 'warning',
      title: 'Solar Radiation Alert',
      message:
        state.shelterPosture === 'shelter'
          ? 'Crew sheltered — simulated exposure reduced.'
          : 'Move crew to Radiation Shelter to reduce simulated exposure.',
      moduleId: 'shelter',
    });
  }
  if (state.oxygen < 30) {
    alerts.push({
      id: 'low-o2',
      severity: state.oxygen < 16 ? 'critical' : 'warning',
      title: 'Low Oxygen',
      message: state.lifeSupportActive
        ? 'Oxygen reserves dropping. Check scrubber condition and power.'
        : 'Activate Habitat Life Support immediately!',
      moduleId: 'habitat',
    });
  }
  if (state.water < 28) {
    alerts.push({
      id: 'low-water',
      severity: state.water < 14 ? 'critical' : 'warning',
      title: 'Low Water',
      message: 'Reduce cultivation draw or repair water recycler.',
      moduleId: 'habitat',
    });
  }
  if (state.food < 25) {
    alerts.push({
      id: 'low-food',
      severity: state.food < 12 ? 'critical' : 'warning',
      title: 'Low Food',
      message: 'Harvest greenhouse crops or adjust rations.',
      moduleId: 'greenhouse',
    });
  }
  if (state.power < 24) {
    alerts.push({
      id: 'low-power',
      severity: state.power < 12 ? 'critical' : 'warning',
      title: 'Low Battery Power',
      message: 'Turn off grow lights or repair solar array.',
      moduleId: 'solar',
    });
  }
  const failedEq = Object.values(state.equipment).filter((e) => e.failed);
  if (failedEq.length > 0) {
    alerts.push({
      id: 'eq-fail',
      severity: 'critical',
      title: 'Equipment Malfunction',
      message: `${failedEq.map((e) => e.name).join(' & ')} offline.`,
      moduleId: failedEq[0].moduleId,
    });
  }
  return alerts;
}

export function isDay1Complete(state: GameState): boolean {
  const c = state.day1Checklist;
  return (
    c.habitatInspected &&
    c.waterChecked &&
    c.solarActivated &&
    c.foodAllocated &&
    c.shelterInspected
  );
}

export function finalizeMissionReport(state: GameState): GameState {
  let score = 0;
  const successes: string[] = [...state.successes];
  const mistakes: string[] = [...state.mistakes];

  if (state.crewHealth <= 0 || state.oxygen <= 0 || state.water <= 0) {
    const reason =
      state.oxygen <= 0
        ? 'Oxygen was exhausted before Day 5 concluded.'
        : state.water <= 0
          ? 'Water reserves ran dry during the mission.'
          : 'Crew health dropped to zero due to compounded survival hazards.';
    return {
      ...state,
      phase: 'report',
      outcome: 'failure',
      outcomeReason: reason,
      mistakes: [...mistakes, reason],
      successes,
      score: Math.max(50, Math.round(state.day * 80 + state.crewHealth * 2)),
    };
  }

  score += Math.round(state.crewHealth * 4);
  score += Math.round((state.oxygen + state.water + state.food + state.power) * 1.1);
  score += state.cropCyclesHarvested * 65;
  score -= Math.round(state.simulatedExposureMSv * 1.8);

  const unrepaired = Object.values(state.equipment).filter((e) => e.failed);
  if (state.simulatedExposureMSv < 55) {
    successes.push('Kept simulated crew radiation exposure within safe mission limits.');
  } else {
    mistakes.push('Allowed elevated simulated radiation exposure during solar alerts.');
  }

  if (unrepaired.length === 0) {
    successes.push('Maintained all critical base equipment in working order.');
  } else {
    mistakes.push(`Left ${unrepaired.map((u) => u.name).join(', ')} unrepaired.`);
  }

  const criticalLow =
    state.oxygen < 20 || state.water < 20 || state.food < 15 || state.power < 15;
  const partialIssues =
    state.crewHealth < 65 ||
    state.simulatedExposureMSv >= 85 ||
    unrepaired.length > 0 ||
    criticalLow;

  const outcome = partialIssues ? 'partial' : 'success';
  const outcomeReason =
    outcome === 'success'
      ? 'Mission successful — Your crew survived all five days with stable life support.'
      : 'Partial success — Your crew survived, but the base suffered critical strain or equipment failures.';

  return {
    ...state,
    phase: 'report',
    outcome,
    outcomeReason,
    successes,
    mistakes,
    score: Math.max(120, Math.min(1000, score)),
  };
}

export function advanceToNextDay(state: GameState): GameState {
  if (state.day >= 5) {
    return finalizeMissionReport(state);
  }
  const nextDay = state.day + 1;
  const next: GameState = {
    ...state,
    day: nextDay,
    shiftHour: 6.0,
    day3WarningActive: false,
    day5StormActive: false,
    shelterPosture: 'outdoor',
    lastFeedback: {
      id: `day-${nextDay}`,
      whatChanged: `Mission Day ${nextDay} started`,
      whyChanged: DAY_TITLES[nextDay],
      nextConsider: DAY_GOALS[nextDay],
      tone: 'good',
    },
  };
  next.alerts = computeAlerts(next);
  return next;
}

export function stepSimulation(
  prev: GameState,
  dtSeconds: number,
  nasa: NasaMissionDataset,
): GameState {
  if (prev.phase !== 'playing' || prev.simSpeed === 0) return prev;

  // 0.42 shift-hours per real second at 1x speed (~38s per day)
  const shiftDelta = dtSeconds * 0.42 * prev.simSpeed;
  let nextHour = prev.shiftHour + shiftDelta;

  const next: GameState = {
    ...prev,
    equipment: {
      solar: { ...prev.equipment.solar },
      battery: { ...prev.equipment.battery },
      water_recycler: { ...prev.equipment.water_recycler },
      oxygen_scrubber: { ...prev.equipment.oxygen_scrubber },
    },
  };

  // Trigger Day 3 space-weather warning at 08:30
  if (next.day === 3 && !next.day3WarningActive && nextHour >= 8.5 && !next.day3ChoiceMade) {
    next.day3WarningActive = true;
    next.selectedModule = 'shelter';
    next.lastFeedback = {
      id: 'd3-warn',
      whatChanged: 'Space-weather warning issued',
      whyChanged: nasa.featuredDay3Scenario.briefSummary,
      nextConsider: 'Open Radiation Shelter and choose whether to shelter, delay, or continue.',
      tone: 'warn',
    };
  }

  // Trigger Day 4 equipment failure at 08:00
  if (next.day === 4 && !next.day4MalfunctionTriggered && nextHour >= 8.0) {
    next.day4MalfunctionTriggered = true;
    next.equipment.solar.failed = true;
    next.equipment.solar.condition = 42;
    next.equipment.solar.failureDescription = 'Solar gimbal jammed — power generation cut by 55%.';
    next.equipment.water_recycler.failed = true;
    next.equipment.water_recycler.condition = 38;
    next.equipment.water_recycler.failureDescription = 'Water recovery valve leaking — losing extra water.';
    next.selectedModule = 'solar';
    next.lastFeedback = {
      id: 'd4-fail',
      whatChanged: 'Solar Array & Water Loop malfunctioned',
      whyChanged: 'Lunar thermal stress damaged both actuators overnight.',
      nextConsider: 'Choose which system to repair first using your limited repair kits.',
      tone: 'bad',
    };
  }

  // Trigger Day 5 space-weather surge at 09:30
  if (next.day === 5 && !next.day5StormActive && nextHour >= 9.5 && !next.day5ChoiceMade) {
    next.day5StormActive = true;
    next.selectedModule = 'shelter';
    next.lastFeedback = {
      id: 'd5-storm',
      whatChanged: 'Final-day solar storm alert',
      whyChanged: nasa.featuredDay5Scenario.briefSummary,
      nextConsider: 'Balance shelter power cost against crew radiation protection.',
      tone: 'warn',
    };
  }

  // Hold end-of-Day-1 at 20:30 if checklist incomplete so learner finishes tutorial
  if (next.day === 1 && !isDay1Complete(next) && nextHour > 20.5) {
    nextHour = 20.5;
  }
  // Hold Day 3 / Day 5 at 19:30 if critical storm choice hasn't been answered yet
  if (next.day === 3 && next.day3WarningActive && !next.day3ChoiceMade && nextHour > 19.5) {
    nextHour = 19.5;
  }
  if (next.day === 5 && next.day5StormActive && !next.day5ChoiceMade && nextHour > 19.5) {
    nextHour = 19.5;
  }

  next.shiftHour = nextHour;

  // Resource simulation rates (per shift-hour)
  const solarGen = next.solarActive
    ? (next.equipment.solar.failed ? 2.2 : 5.2) * (next.equipment.solar.condition / 100)
    : 0;
  const powerDraw =
    (next.lifeSupportActive ? 1.65 : 0.4) +
    (next.greenhouseLightsOn ? 1.75 : 0) +
    (next.shelterPosture === 'shelter' ? 1.4 : 0) +
    (next.equipment.battery.failed ? 1.0 : 0);

  next.power = clamp(next.power + (solarGen - powerDraw) * shiftDelta);

  // Oxygen
  const o2Recovery =
    next.lifeSupportActive && next.power > 4
      ? 2.38 * (next.equipment.oxygen_scrubber.condition / 100)
      : 0;
  const o2Use = 2.2 + (next.shelterPosture === 'outdoor' ? 0.25 : 0);
  next.oxygen = clamp(next.oxygen + (o2Recovery - o2Use) * shiftDelta);

  // Water
  const waterRecovery = next.equipment.water_recycler.failed ? 0.45 : 1.9;
  const waterDraw =
    next.waterAllocation === 'drinking'
      ? 1.5
      : next.waterAllocation === 'balanced'
        ? 1.98
        : 2.5;
  const leak = next.equipment.water_recycler.failed ? 1.2 : 0;
  next.water = clamp(next.water + (waterRecovery - waterDraw - leak) * shiftDelta);

  // Food & Greenhouse plant growth
  const foodDraw =
    next.rations === 'conserve' ? 0.65 : next.rations === 'standard' ? 1.05 : 1.48;
  next.food = clamp(next.food - foodDraw * shiftDelta);

  if (next.day >= 2) {
    const lightBoost = next.greenhouseLightsOn && next.power > 8 ? 1.0 : 0.25;
    const waterBoost =
      next.water > 10
        ? next.waterAllocation === 'cultivation'
          ? 4.6
          : next.waterAllocation === 'balanced'
            ? 2.9
            : 1.2
        : 0;
    next.cropGrowth = clamp(next.cropGrowth + waterBoost * lightBoost * shiftDelta);
  }

  // Simulated lunar radiation exposure
  const stormActive = next.day3WarningActive || next.day5StormActive;
  let rateMSvHr = 0.25;
  if (stormActive) {
    if (next.shelterPosture === 'shelter') rateMSvHr = 0.42;
    else if (next.shelterPosture === 'habitat_hold') rateMSvHr = 1.95;
    else rateMSvHr = 4.9;
  } else {
    if (next.shelterPosture === 'shelter') rateMSvHr = 0.05;
    else if (next.shelterPosture === 'habitat_hold') rateMSvHr = 0.14;
    else rateMSvHr = 0.28;
  }
  next.simulatedExposureMSv = Math.max(0, next.simulatedExposureMSv + rateMSvHr * shiftDelta);
  next.exposureRateMicroSvHr = Math.round(rateMSvHr * 1000);

  // Crew health
  let healthDelta = 0;
  if (next.oxygen < 22) healthDelta -= 4.5;
  if (next.water < 18) healthDelta -= 3.5;
  if (next.food < 15) healthDelta -= 2.4;
  if (next.rations === 'conserve') healthDelta -= 0.35;
  if (next.waterAllocation === 'cultivation') healthDelta -= 0.4;
  if (next.simulatedExposureMSv > 95) healthDelta -= 2.2;
  if (
    healthDelta === 0 &&
    next.oxygen > 50 &&
    next.water > 45 &&
    next.food > 35 &&
    next.power > 20
  ) {
    healthDelta = next.rations === 'high' ? 0.85 : 0.35;
  }
  next.crewHealth = clamp(next.crewHealth + healthDelta * shiftDelta);

  // Check immediate mission failure
  if (next.crewHealth <= 0 || next.oxygen <= 0 || next.water <= 0) {
    return finalizeMissionReport(next);
  }

  // Advance day at 22:00
  if (next.shiftHour >= 22.0) {
    return advanceToNextDay(next);
  }

  next.alerts = computeAlerts(next);
  return next;
}

export function applyModuleAction(
  prev: GameState,
  action:
    | { type: 'select_module'; moduleId: ModuleId | null }
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
): GameState {
  const next: GameState = {
    ...prev,
    day1Checklist: { ...prev.day1Checklist },
    equipment: {
      solar: { ...prev.equipment.solar },
      battery: { ...prev.equipment.battery },
      water_recycler: { ...prev.equipment.water_recycler },
      oxygen_scrubber: { ...prev.equipment.oxygen_scrubber },
    },
    decisionLog: [...prev.decisionLog],
    mistakes: [...prev.mistakes],
    successes: [...prev.successes],
  };

  const hourStr = formatShiftClock(next.shiftHour);

  switch (action.type) {
    case 'select_module':
      next.selectedModule = action.moduleId;
      return next;

    case 'activate_life_support':
      next.lifeSupportActive = true;
      next.day1Checklist.habitatInspected = true;
      next.oxygen = clamp(next.oxygen + 5);
      next.decisionLog.push({
        day: next.day,
        hour: hourStr,
        title: 'Habitat Life Support',
        choice: 'Activated CO2 scrubbers and air circulation',
        consequence: 'Oxygen recycling stabilized; consumes steady battery power.',
        impact: 'positive',
      });
      next.lastFeedback = {
        id: `ls-${Date.now()}`,
        whatChanged: 'Life Support active (+O2 recycling)',
        whyChanged: 'Scrubbers convert crew CO2 back into breathable cabin air.',
        nextConsider: 'Keep battery power above 10% so life support never stalls.',
        tone: 'good',
      };
      break;

    case 'check_water_system':
      next.day1Checklist.waterChecked = true;
      next.water = clamp(next.water + 4);
      next.lastFeedback = {
        id: `ws-${Date.now()}`,
        whatChanged: 'Water loop primed (+4% reserve)',
        whyChanged: 'Condensed cabin moisture is now routed into the recovery tank.',
        nextConsider: 'On Day 2, decide how much water goes to plants vs drinking.',
        tone: 'good',
      };
      break;

    case 'activate_solar':
      next.solarActive = true;
      next.day1Checklist.solarActivated = true;
      next.power = clamp(next.power + 6);
      next.decisionLog.push({
        day: next.day,
        hour: hourStr,
        title: 'Solar Array Activation',
        choice: 'Deployed and locked photovoltaic trackers',
        consequence: 'Base batteries now recharge during lunar daylight.',
        impact: 'positive',
      });
      next.lastFeedback = {
        id: `sol-${Date.now()}`,
        whatChanged: 'Solar Panels online (+Battery charging)',
        whyChanged: 'Solar wings convert lunar sunlight into electrical power.',
        nextConsider: 'Greenhouse lights and shelter systems draw extra power.',
        tone: 'good',
      };
      break;

    case 'set_rations':
      next.rations = action.rations;
      next.day1Checklist.foodAllocated = true;
      next.decisionLog.push({
        day: next.day,
        hour: hourStr,
        title: 'Food Ration Plan',
        choice: `Set rations to ${action.rations}`,
        consequence:
          action.rations === 'conserve'
            ? 'Saves food, but slowly wears down crew stamina.'
            : action.rations === 'high'
              ? 'Supports crew recovery, but consumes food faster.'
              : 'Balanced calorie intake and food endurance.',
        impact: action.rations === 'conserve' ? 'neutral' : 'positive',
      });
      next.lastFeedback = {
        id: `rat-${Date.now()}`,
        whatChanged: `Food rations set to ${action.rations.toUpperCase()}`,
        whyChanged:
          action.rations === 'conserve'
            ? 'Lower food use stretches supplies at a small health cost.'
            : action.rations === 'high'
              ? 'Higher calories boost crew health while depleting stores faster.'
              : 'Balanced consumption for steady 5-day survival.',
        nextConsider: 'Grow crops in the Greenhouse to replenish food.',
        tone: 'good',
      };
      break;

    case 'set_water_allocation':
      next.waterAllocation = action.allocation;
      next.day2WaterDecided = true;
      next.decisionLog.push({
        day: next.day,
        hour: hourStr,
        title: 'Water Allocation',
        choice: `Prioritized ${action.allocation} water use`,
        consequence:
          action.allocation === 'cultivation'
            ? 'Boosts plant growth speed, but draws more water from reserves.'
            : action.allocation === 'drinking'
              ? 'Protects hydration and water reserves; plants grow slowly.'
              : 'Splits water evenly between crew hydration and crops.',
        impact: action.allocation === 'balanced' ? 'positive' : 'neutral',
      });
      next.lastFeedback = {
        id: `wa-${Date.now()}`,
        whatChanged: `Water mode: ${action.allocation.toUpperCase()}`,
        whyChanged:
          action.allocation === 'cultivation'
            ? 'More water feeds greenhouse crops, reducing drinking reserves.'
            : action.allocation === 'drinking'
              ? 'Preserves crew water at the cost of slower plant growth.'
              : 'Balances hydration, hygiene, and steady plant growth.',
        nextConsider: 'Watch the Water meter and turn on grow lights when power allows.',
        tone: action.allocation === 'cultivation' && next.water < 35 ? 'warn' : 'good',
      };
      break;

    case 'toggle_grow_lights':
      next.greenhouseLightsOn = !next.greenhouseLightsOn;
      next.lastFeedback = {
        id: `gl-${Date.now()}`,
        whatChanged: next.greenhouseLightsOn ? 'Grow lights ON' : 'Grow lights OFF',
        whyChanged: next.greenhouseLightsOn
          ? 'Plants grow much faster, but battery draw increases.'
          : 'Battery power saved, but crop growth slows down.',
        nextConsider: 'Turn lights off if Battery drops below 30%.',
        tone: next.greenhouseLightsOn && next.power < 35 ? 'warn' : 'good',
      };
      break;

    case 'harvest_crops':
      if (next.cropGrowth >= 99) {
        next.food = clamp(next.food + 24);
        next.oxygen = clamp(next.oxygen + 5);
        next.cropGrowth = 12;
        next.cropCyclesHarvested += 1;
        next.successes.push('Cultivated and harvested fresh greenhouse crops on the Moon.');
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: 'Greenhouse Harvest',
          choice: 'Harvested mature hydroponic crops',
          consequence: 'Added +24% Food and +5% Oxygen from plant photosynthesis.',
          impact: 'positive',
        });
        next.lastFeedback = {
          id: `harv-${Date.now()}`,
          whatChanged: 'Crops harvested (+24% Food, +5% O2)',
          whyChanged: 'Mature plants replenish crew food and release oxygen.',
          nextConsider: 'Keep watering and lighting to start a second harvest.',
          tone: 'good',
        };
      }
      break;

    case 'inspect_shelter':
      next.day1Checklist.shelterInspected = true;
      next.lastFeedback = {
        id: `sh-${Date.now()}`,
        whatChanged: 'Radiation Shelter verified',
        whyChanged: 'Regolith-covered walls block incoming solar particles.',
        nextConsider: 'Use this shelter whenever a solar radiation warning triggers.',
        tone: 'good',
      };
      break;

    case 'set_shelter_posture': {
      next.shelterPosture = action.posture;
      const isStorm = next.day3WarningActive || next.day5StormActive;
      if (next.day === 3) next.day3ChoiceMade = action.posture;
      if (next.day === 5) next.day5ChoiceMade = action.posture;

      if (action.posture === 'shelter') {
        next.power = clamp(next.power - 4);
        if (isStorm) {
          next.successes.push(`Day ${next.day}: Protected crew inside the radiation shelter.`);
        }
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: `Day ${next.day} Radiation Response`,
          choice: 'Entered Radiation Shelter',
          consequence: 'Simulated exposure dropped sharply; shelter systems used extra battery.',
          impact: 'positive',
        });
        next.lastFeedback = {
          id: `sp-${Date.now()}`,
          whatChanged: 'Crew inside Radiation Shelter (-4% Power)',
          whyChanged: 'Sheltering reduces simulated exposure during this event, while using battery power.',
          nextConsider: 'Monitor battery charge and return outdoors once the alert clears.',
          tone: 'good',
        };
      } else if (action.posture === 'habitat_hold') {
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: `Day ${next.day} Radiation Response`,
          choice: 'Delayed Outdoor Operations (Stay in Habitat)',
          consequence: 'Moderate shielding saved shelter power, though outdoor work paused.',
          impact: 'neutral',
        });
        next.lastFeedback = {
          id: `sp-${Date.now()}`,
          whatChanged: 'Outdoor work delayed — crew in Habitat',
          whyChanged: 'Habitat walls give partial protection without heavy shelter power draw.',
          nextConsider: 'Move to the bunker if simulated exposure climbs too quickly.',
          tone: 'warn',
        };
      } else {
        if (isStorm) {
          next.mistakes.push(`Day ${next.day}: Continued outdoor work during a radiation warning.`);
        }
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: `Day ${next.day} Radiation Response`,
          choice: 'Continued Outdoor Work',
          consequence: 'Saved shelter power, but simulated crew radiation exposure increased!',
          impact: isStorm ? 'negative' : 'neutral',
        });
        next.lastFeedback = {
          id: `sp-${Date.now()}`,
          whatChanged: isStorm ? 'Outdoor exposure rising!' : 'Crew resumed outdoor duties',
          whyChanged: isStorm
            ? 'Outdoor astronauts lack regolith shielding during the warning.'
            : 'Normal base operations resumed.',
          nextConsider: isStorm
            ? 'Enter the Radiation Shelter before crew health suffers.'
            : 'Check oxygen and power meters.',
          tone: isStorm ? 'bad' : 'good',
        };
      }
      break;
    }

    case 'repair_system': {
      const sys = next.equipment[action.systemId];
      if (!sys.failed && sys.condition >= 95) return prev;

      if (!action.emergencyPatch && next.repairKits > 0) {
        next.repairKits -= 1;
        sys.failed = false;
        sys.condition = 98;
        sys.failureDescription = null;
        if (next.day === 4) next.day4FirstRepairDone = true;
        next.successes.push(`Repaired ${sys.name} cleanly with a repair kit.`);
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: 'Equipment Repair',
          choice: `Repaired ${sys.name} (1 Repair Kit)`,
          consequence: `${sys.name} restored to 98% condition.`,
          impact: 'positive',
        });
        next.lastFeedback = {
          id: `rep-${Date.now()}`,
          whatChanged: `${sys.name} restored (98%)`,
          whyChanged: 'Used 1 Repair Kit to replace the damaged hardware assembly.',
          nextConsider: `Repair kits remaining: ${next.repairKits}. Prioritize critical systems.`,
          tone: 'good',
        };
      } else if (action.emergencyPatch && next.power >= 15) {
        next.power = clamp(next.power - 14);
        sys.failed = false;
        sys.condition = 74;
        sys.failureDescription = null;
        if (next.day === 4) next.day4FirstRepairDone = true;
        next.decisionLog.push({
          day: next.day,
          hour: hourStr,
          title: 'Emergency Power Patch',
          choice: `Jury-rigged ${sys.name} (-14% Power)`,
          consequence: 'System restored to 74% efficiency without spending a repair kit.',
          impact: 'neutral',
        });
        next.lastFeedback = {
          id: `pat-${Date.now()}`,
          whatChanged: `${sys.name} patched (74% · -14% Power)`,
          whyChanged: 'Rerouted battery power to bypass the broken regulator.',
          nextConsider: 'Watch battery reserves while running patched hardware.',
          tone: 'warn',
        };
      }
      break;
    }
  }

  next.alerts = computeAlerts(next);
  return next;
}
