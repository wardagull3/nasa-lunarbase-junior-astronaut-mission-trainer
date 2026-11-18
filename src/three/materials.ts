import * as THREE from 'three';

export interface LunarMaterialLibrary {
  regolith: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  habHull: THREE.MeshStandardMaterial;
  habGoldFoil: THREE.MeshPhysicalMaterial;
  darkAlloy: THREE.MeshStandardMaterial;
  accentOrange: THREE.MeshStandardMaterial;
  accentCyan: THREE.MeshStandardMaterial;
  solarCell: THREE.MeshStandardMaterial;
  glassDome: THREE.MeshPhysicalMaterial;
  visorGold: THREE.MeshPhysicalMaterial;
  suitWhite: THREE.MeshStandardMaterial;
  suitBackpack: THREE.MeshStandardMaterial;
  hydroponicBed: THREE.MeshStandardMaterial;
  plantLeaf: THREE.MeshStandardMaterial;
  shelterRegolith: THREE.MeshStandardMaterial;
  hazardStripe: THREE.MeshStandardMaterial;
  windowGlow: THREE.MeshStandardMaterial;
  beaconGlow: THREE.MeshStandardMaterial;
  earthMat: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function makeRegolithTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6f737d';
  ctx.fillRect(0, 0, size, size);

  // Fine lunar dust grain and micro-craters
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 2.2;
    const v = Math.floor(92 + rand() * 48);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.fillRect(x, y, r, r);
  }

  for (let i = 0; i < 42; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 6 + rand() * 18;
    const grad = ctx.createRadialGradient(x, y, rad * 0.15, x, y, rad);
    grad.addColorStop(0, 'rgba(54,58,66,0.55)');
    grad.addColorStop(0.75, 'rgba(85,89,98,0.25)');
    grad.addColorStop(0.92, 'rgba(155,160,172,0.35)');
    grad.addColorStop(1, 'rgba(111,115,125,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSolarCellTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0d1e3a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const p = i * 32;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 32; i++) {
    const p = i * 8 + 4;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#18181b';
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i - 48, 128);
    ctx.lineTo(i - 64, 128);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const ocean = ctx.createLinearGradient(0, 0, 0, 256);
  ocean.addColorStop(0, '#1e3a8a');
  ocean.addColorStop(0.5, '#1d4ed8');
  ocean.addColorStop(1, '#1e40af');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 512, 256);

  // Stylized continents
  ctx.fillStyle = '#2d7a4f';
  const patches = [
    [120, 95, 52, 34],
    [165, 138, 28, 42],
    [260, 82, 68, 36],
    [290, 132, 35, 45],
    [365, 90, 62, 38],
    [405, 165, 34, 24],
  ];
  patches.forEach(([x, y, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // Polar caps
  ctx.fillStyle = 'rgba(241,245,249,0.85)';
  ctx.fillRect(0, 0, 512, 22);
  ctx.fillRect(0, 234, 512, 22);

  // Cloud swirls
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  for (let i = 0; i < 24; i++) {
    const cx = (i * 47 + 20) % 512;
    const cy = 35 + ((i * 29) % 185);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 28 + (i % 4) * 10, 7, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLunarMaterialLibrary(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): LunarMaterialLibrary {
  const regolithTex = makeRegolithTexture();
  const solarTex = makeSolarCellTexture();
  const hazardTex = makeHazardTexture();
  const earthTex = makeEarthTexture();
  const shadowTex = makeContactShadowTexture();

  [regolithTex, solarTex, hazardTex, earthTex].forEach((t) => {
    t.anisotropy = maxAnisotropy;
  });

  const regolith = new THREE.MeshStandardMaterial({
    map: regolithTex,
    color: 0xb6bbc7,
    roughness: 0.94,
    metalness: 0.04,
  });

  const rock = new THREE.MeshStandardMaterial({
    color: 0x6b707d,
    roughness: 0.9,
    metalness: 0.08,
  });

  const habHull = new THREE.MeshStandardMaterial({
    color: 0xe6ebf2,
    roughness: 0.38,
    metalness: 0.25,
  });

  const habGoldFoil = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    roughness: 0.24,
    metalness: 0.92,
    anisotropy: isSoftwareGl ? 0 : 0.75,
    clearcoat: 0.35,
  });

  const darkAlloy = new THREE.MeshStandardMaterial({
    color: 0x2a3140,
    roughness: 0.45,
    metalness: 0.78,
  });

  const accentOrange = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
    metalness: 0.15,
  });

  const accentCyan = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.35,
    metalness: 0.2,
  });

  const solarCell = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.18,
    metalness: 0.65,
  });

  const glassDome = new THREE.MeshPhysicalMaterial({
    color: 0xcffafe,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.92,
    ior: 1.48,
    thickness: 0.4,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const visorGold = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    roughness: 0.1,
    metalness: 0.95,
    clearcoat: 1.0,
  });

  const suitWhite = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.62,
    metalness: 0.06,
  });

  const suitBackpack = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.42,
    metalness: 0.55,
  });

  const hydroponicBed = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.4,
  });

  const plantLeaf = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.68,
    metalness: 0.02,
  });

  const shelterRegolith = new THREE.MeshStandardMaterial({
    map: regolithTex,
    color: 0x7b818f,
    roughness: 0.92,
    metalness: 0.08,
  });

  const hazardStripe = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.5,
    metalness: 0.15,
  });

  const windowGlow = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.1,
  });

  const beaconGlow = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.1,
  });

  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 0.72,
    metalness: 0.05,
    emissive: 0x0b1f44,
    emissiveIntensity: 0.35,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  const allMaterials: THREE.Material[] = [
    regolith,
    rock,
    habHull,
    habGoldFoil,
    darkAlloy,
    accentOrange,
    accentCyan,
    solarCell,
    glassDome,
    visorGold,
    suitWhite,
    suitBackpack,
    hydroponicBed,
    plantLeaf,
    shelterRegolith,
    hazardStripe,
    windowGlow,
    beaconGlow,
    earthMat,
    contactShadow,
  ];
  const allTextures: THREE.Texture[] = [regolithTex, solarTex, hazardTex, earthTex, shadowTex];

  return {
    regolith,
    rock,
    habHull,
    habGoldFoil,
    darkAlloy,
    accentOrange,
    accentCyan,
    solarCell,
    glassDome,
    visorGold,
    suitWhite,
    suitBackpack,
    hydroponicBed,
    plantLeaf,
    shelterRegolith,
    hazardStripe,
    windowGlow,
    beaconGlow,
    earthMat,
    contactShadow,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
