import * as THREE from 'three';
import type { ModuleId } from '../types/game';
import type { LunarMaterialLibrary } from './materials';

export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  // Smooth flat landing pad for the base core (radius <= 14)
  const padBlend = THREE.MathUtils.smoothstep(dist, 13.5, 22);
  const undulation =
    Math.sin(x * 0.08) * Math.cos(z * 0.08) * 1.15 +
    Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17) * 0.35;

  // Deterministic craters outside the base pad
  const craters: Array<[number, number, number, number]> = [
    [-26, -18, 8.5, 1.8],
    [28, -22, 10.0, 2.1],
    [-24, 25, 7.5, 1.5],
    [25, 24, 9.0, 1.7],
    [0, -34, 11.5, 2.3],
  ];
  let craterOffset = 0;
  for (const [cx, cz, rad, depth] of craters) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < rad * 1.35) {
      const n = d / rad;
      if (n < 1) {
        craterOffset -= (1 - n * n) * depth;
      } else {
        // Subtle raised crater rim
        const rim = 1 - Math.abs(n - 1.15) / 0.2;
        if (rim > 0) craterOffset += rim * depth * 0.28;
      }
    }
  }

  // Gentle outer ridge rise near perimeter
  const rimRise = THREE.MathUtils.smoothstep(dist, 48, 82) * 9.5;
  return (undulation + craterOffset) * padBlend + rimRise;
}

function attachHitbox(
  group: THREE.Group,
  moduleId: ModuleId,
  width: number,
  height: number,
  depth: number,
  yOffset?: number,
) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(geo, mat);
  hitbox.position.y = yOffset ?? height * 0.5;
  hitbox.layers.set(1);
  hitbox.userData.moduleId = moduleId;
  group.add(hitbox);
}

function addContactShadow(group: THREE.Group, mats: LunarMaterialLibrary, radius: number) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mats.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.renderOrder = 1;
  group.add(shadow);
}

export interface HabitatRefs {
  group: THREE.Group;
  windowMat: THREE.MeshStandardMaterial;
  beaconMat: THREE.MeshStandardMaterial;
  fanMesh: THREE.Mesh;
}

export function buildLunarHabitat(mats: LunarMaterialLibrary): HabitatRefs {
  const group = new THREE.Group();
  group.userData.moduleId = 'habitat';
  addContactShadow(group, mats, 5.2);

  // Foundation plinth
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.4, 0.28, 24), mats.darkAlloy);
  pad.position.y = 0.14;
  pad.receiveShadow = true;
  group.add(pad);

  // Main cylindrical hull (horizontal along X)
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 5.2, 24), mats.habHull);
  hull.rotation.z = Math.PI / 2;
  hull.position.set(0, 1.95, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Spherical endcaps
  [-2.6, 2.6].forEach((x) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.74, 20, 16), mats.habHull);
    cap.scale.set(0.55, 1, 1);
    cap.position.set(x, 1.95, 0);
    cap.castShadow = true;
    group.add(cap);
  });

  // Structural metallic collar rings
  [-1.7, 0, 1.7].forEach((x) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.08, 10, 28), mats.darkAlloy);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 1.95, 0);
    ring.castShadow = true;
    group.add(ring);
  });

  // Rear gold MLI thermal module
  const thermalBay = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 2.2), mats.habGoldFoil);
  thermalBay.position.set(-2.3, 1.35, -1.6);
  thermalBay.castShadow = true;
  group.add(thermalBay);

  // External O2 / N2 pressure spheres
  [-0.75, 0.75].forEach((x) => {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mats.accentCyan);
    tank.position.set(x, 0.9, -2.05);
    tank.castShadow = true;
    group.add(tank);
  });

  // Airlock vestibule facing +Z
  const airlock = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.1, 1.9), mats.habHull);
  airlock.position.set(0, 1.2, 2.15);
  airlock.castShadow = true;
  airlock.receiveShadow = true;
  group.add(airlock);

  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.55, 0.14), mats.darkAlloy);
  hatch.position.set(0, 1.05, 3.12);
  group.add(hatch);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.2, 1.94), mats.hazardStripe);
  stripe.position.set(0, 0.36, 2.15);
  group.add(stripe);

  // Glowing portholes (dedicated clonable material for dynamic power/alert tint)
  const windowMat = mats.windowGlow.clone();
  [-1.2, 1.2].forEach((x) => {
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 16), mats.darkAlloy);
    frame.rotation.x = Math.PI / 2;
    frame.position.set(x, 2.05, 1.72);
    group.add(frame);

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.16, 16), windowMat);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(x, 2.05, 1.73);
    group.add(glass);
  });

  // Roof radiator / life-support fan unit
  const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.35, 16), mats.darkAlloy);
  fanHousing.position.set(0, 3.82, 0);
  group.add(fanHousing);

  const fanMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.22), mats.accentOrange);
  fanMesh.position.set(0, 4.02, 0);
  group.add(fanMesh);

  const beaconMat = mats.beaconGlow.clone();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), beaconMat);
  beacon.position.set(2.2, 3.6, 0);
  group.add(beacon);

  attachHitbox(group, 'habitat', 6.8, 4.3, 5.4);
  return { group, windowMat, beaconMat, fanMesh };
}

export interface SolarRefs {
  group: THREE.Group;
  trackerGroup: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
}

export function buildSolarArray(mats: LunarMaterialLibrary): SolarRefs {
  const group = new THREE.Group();
  group.userData.moduleId = 'solar';
  addContactShadow(group, mats, 4.2);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.4, 0.3, 12), mats.darkAlloy);
  base.position.y = 0.15;
  base.receiveShadow = true;
  group.add(base);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 2.2, 12), mats.habHull);
  mast.position.y = 1.25;
  mast.castShadow = true;
  group.add(mast);

  // Power converter cabinet
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.7), mats.habGoldFoil);
  cabinet.position.set(0.75, 0.7, 0);
  cabinet.castShadow = true;
  group.add(cabinet);

  const beaconMat = mats.beaconGlow.clone();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), beaconMat);
  beacon.position.set(0.75, 1.35, 0);
  group.add(beacon);

  // Gimbaled tracker wing assembly
  const trackerGroup = new THREE.Group();
  trackerGroup.position.set(0, 2.35, 0);
  group.add(trackerGroup);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.22), mats.darkAlloy);
  crossbar.castShadow = true;
  trackerGroup.add(crossbar);

  [-2.35, -0.82, 0.82, 2.35].forEach((x) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 3.0), mats.darkAlloy);
    frame.position.set(x, 0.04, 0);
    frame.castShadow = true;
    trackerGroup.add(frame);

    const cell = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.04, 2.86), mats.solarCell);
    cell.position.set(x, 0.08, 0);
    trackerGroup.add(cell);
  });

  trackerGroup.rotation.x = 0.42;

  attachHitbox(group, 'solar', 7.2, 3.8, 3.6);
  return { group, trackerGroup, beaconMat };
}

export interface GreenhouseRefs {
  group: THREE.Group;
  plantGroup: THREE.Group;
  growLightMat: THREE.MeshStandardMaterial;
}

export function buildGreenhouse(mats: LunarMaterialLibrary): GreenhouseRefs {
  const group = new THREE.Group();
  group.userData.moduleId = 'greenhouse';
  addContactShadow(group, mats, 4.1);

  // Concrete-like sintered curb
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.45, 0.55, 24), mats.darkAlloy);
  curb.position.y = 0.275;
  curb.receiveShadow = true;
  curb.castShadow = true;
  group.add(curb);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.08, 24), mats.hydroponicBed);
  floor.position.y = 0.56;
  floor.receiveShadow = true;
  group.add(floor);

  // Hydroponic planter troughs
  [-1.35, 0, 1.35].forEach((z) => {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.36, 0.72), mats.habHull);
    bed.position.set(0, 0.76, z);
    bed.castShadow = true;
    bed.receiveShadow = true;
    group.add(bed);
  });

  // Growing plant clusters
  const plantGroup = new THREE.Group();
  plantGroup.position.y = 0.94;
  group.add(plantGroup);

  [-1.35, 0, 1.35].forEach((z) => {
    for (let i = -2; i <= 2; i++) {
      const stalk = new THREE.Group();
      stalk.position.set(i * 0.68, 0, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6), mats.plantLeaf);
      stem.position.y = 0.175;
      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mats.plantLeaf);
      canopy.position.y = 0.36;
      stalk.add(stem, canopy);
      plantGroup.add(stalk);
    }
  });

  // Geodesic structural ribs
  for (let i = 0; i < 4; i++) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(3.12, 0.065, 8, 28, Math.PI),
      mats.habHull,
    );
    arch.position.y = 0.52;
    arch.rotation.y = (i * Math.PI) / 4;
    group.add(arch);
  }

  // Grow-light ring inside dome
  const growLightMat = new THREE.MeshStandardMaterial({
    color: 0xe879f9,
    emissive: 0xd946ef,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });
  const lightRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.06, 8, 24), growLightMat);
  lightRing.rotation.x = Math.PI / 2;
  lightRing.position.y = 2.45;
  group.add(lightRing);

  // Outer transparent glass dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.glassDome,
  );
  dome.position.y = 0.52;
  dome.renderOrder = 5;
  group.add(dome);

  attachHitbox(group, 'greenhouse', 6.4, 3.8, 6.4);
  return { group, plantGroup, growLightMat };
}

export interface ShelterRefs {
  group: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
  doorMesh: THREE.Mesh;
}

export function buildRadiationShelter(mats: LunarMaterialLibrary): ShelterRefs {
  const group = new THREE.Group();
  group.userData.moduleId = 'shelter';
  addContactShadow(group, mats, 4.4);

  // Regolith radiation-shielded mound
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.shelterRegolith,
  );
  mound.scale.set(1.15, 0.72, 1.05);
  mound.castShadow = true;
  mound.receiveShadow = true;
  group.add(mound);

  // Armored vestibule frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.1, 1.4), mats.darkAlloy);
  frame.position.set(0, 1.05, 3.25);
  frame.castShadow = true;
  group.add(frame);

  // Blast door
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.65, 0.16), mats.accentOrange);
  doorMesh.position.set(0, 0.92, 3.92);
  group.add(doorMesh);

  // Hazard lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.24, 1.44), mats.hazardStripe);
  lintel.position.set(0, 2.15, 3.25);
  group.add(lintel);

  // Entrance ramp
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 1.3), mats.darkAlloy);
  ramp.position.set(0, 0.08, 4.45);
  ramp.rotation.x = 0.12;
  ramp.receiveShadow = true;
  group.add(ramp);

  // Roof beacon pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), mats.darkAlloy);
  pole.position.set(0, 2.8, 0.5);
  group.add(pole);

  const beaconMat = mats.beaconGlow.clone();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), beaconMat);
  beacon.position.set(0, 3.45, 0.5);
  group.add(beacon);

  attachHitbox(group, 'shelter', 6.8, 3.6, 7.2);
  return { group, beaconMat, doorMesh };
}

export interface CommsRefs {
  group: THREE.Group;
  dishPivot: THREE.Group;
  scannerBar: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
}

export function buildCommsArray(mats: LunarMaterialLibrary): CommsRefs {
  const group = new THREE.Group();
  group.userData.moduleId = 'comms';
  addContactShadow(group, mats, 2.4);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.26, 12), mats.darkAlloy);
  pad.position.y = 0.13;
  pad.receiveShadow = true;
  group.add(pad);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.6, 8), mats.habHull);
  tower.position.y = 1.95;
  tower.castShadow = true;
  group.add(tower);

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.8), mats.habGoldFoil);
  box.position.set(0.65, 0.7, 0);
  box.castShadow = true;
  group.add(box);

  // Parabolic dish via LatheGeometry
  const dishPivot = new THREE.Group();
  dishPivot.position.set(0, 3.55, 0);
  group.add(dishPivot);

  const pts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.45, 0.08),
    new THREE.Vector2(0.95, 0.28),
    new THREE.Vector2(1.35, 0.62),
  ];
  const dishGeo = new THREE.LatheGeometry(pts, 20);
  const dishMat = mats.habHull.clone();
  dishMat.side = THREE.DoubleSide;
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.rotation.x = Math.PI * 0.34;
  dish.castShadow = true;
  dishPivot.add(dish);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 8), mats.darkAlloy);
  feedHorn.position.set(0, 0.55, 0.62);
  feedHorn.rotation.x = Math.PI * 0.34;
  dishPivot.add(feedHorn);

  // Rotating space-weather magnetometer / radar bar
  const scannerBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.14), mats.accentCyan);
  scannerBar.position.set(0, 4.45, 0);
  group.add(scannerBar);

  const beaconMat = mats.beaconGlow.clone();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), beaconMat);
  beacon.position.set(0, 4.65, 0);
  group.add(beacon);

  attachHitbox(group, 'comms', 3.4, 4.9, 3.4);
  return { group, dishPivot, scannerBar, beaconMat };
}

export interface AstronautRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  phaseOffset: number;
  homePos: THREE.Vector3;
  patrolTarget: THREE.Vector3;
}

export function buildAstronaut(
  mats: LunarMaterialLibrary,
  stripeColor: number,
  phaseOffset: number,
): AstronautRig {
  const group = new THREE.Group();
  addContactShadow(group, mats, 0.55);

  const stripeMat = new THREE.MeshStandardMaterial({
    color: stripeColor,
    roughness: 0.45,
    metalness: 0.15,
  });

  // Legs pivoted at hip (y = 0.56)
  const makeLeg = (x: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(x, 0.56, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.46, 8), mats.suitWhite);
    thigh.position.y = -0.23;
    thigh.castShadow = true;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), mats.darkAlloy);
    boot.position.set(0, -0.48, 0.04);
    boot.castShadow = true;
    legPivot.add(thigh, boot);
    group.add(legPivot);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.32), mats.suitWhite);
  torso.position.y = 0.86;
  torso.castShadow = true;
  group.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.34), stripeMat);
  chestStripe.position.y = 0.92;
  group.add(chestStripe);

  // PLSS backpack
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.22), mats.suitBackpack);
  backpack.position.set(0, 0.88, -0.24);
  backpack.castShadow = true;
  group.add(backpack);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), mats.darkAlloy);
  antenna.position.set(0.12, 1.24, -0.24);
  group.add(antenna);

  // Arms pivoted at shoulder (y = 1.06)
  const makeArm = (x: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(x, 1.06, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.44, 8), mats.suitWhite);
    arm.position.y = -0.2;
    arm.castShadow = true;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), stripeMat);
    glove.position.y = -0.43;
    armPivot.add(arm, glove);
    group.add(armPivot);
    return armPivot;
  };
  const leftArm = makeArm(-0.3);
  const rightArm = makeArm(0.3);

  // Helmet + Gold Visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), mats.suitWhite);
  helmet.position.y = 1.34;
  helmet.castShadow = true;
  group.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 14, 12, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.2, Math.PI * 0.55),
    mats.visorGold,
  );
  visor.position.set(0, 1.34, 0.06);
  visor.rotation.y = Math.PI / 2;
  group.add(visor);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    phaseOffset,
    homePos: new THREE.Vector3(),
    patrolTarget: new THREE.Vector3(),
  };
}

export function buildLunarEnvironment(
  scene: THREE.Scene,
  mats: LunarMaterialLibrary,
  isSoftwareGl: boolean,
) {
  // Displaced lunar regolith terrain
  const terrainGeo = new THREE.PlaneGeometry(180, 180, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeightAt(x, z));
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, mats.regolith);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Instanced lunar basalt rocks
  const rockCount = isSoftwareGl ? 75 : 140;
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, mats.rock, rockCount);
  rocks.castShadow = !isSoftwareGl;
  rocks.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();
  let seed = 9182;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < rockCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 14 + rand() * 48;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = groundHeightAt(x, z);
    const s = 0.45 + rand() * 1.45;
    dummy.position.set(x, y + s * 0.25, z);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.set(s * (0.85 + rand() * 0.3), s * (0.55 + rand() * 0.4), s * (0.85 + rand() * 0.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);

    const shade = 0.78 + rand() * 0.35;
    rockColor.setRGB(shade, shade * 0.99, shade * 1.03);
    rocks.setColorAt(i, rockColor);
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  scene.add(rocks);

  // Starfield dome
  const starCount = 1100;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(0.08 + rand() * 0.92);
    const r = 135;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe2e8f0,
    size: 0.65,
    sizeAttenuation: true,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Earth in the lunar sky
  const earth = new THREE.Mesh(new THREE.SphereGeometry(7.2, 32, 24), mats.earthMat);
  earth.position.set(-38, 34, -76);
  scene.add(earth);

  return { terrain, rocks, stars, earth };
}
