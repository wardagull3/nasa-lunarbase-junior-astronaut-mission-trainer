import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLunarMaterialLibrary } from '../three/materials';
import {
  buildAstronaut,
  buildCommsArray,
  buildGreenhouse,
  buildLunarEnvironment,
  buildLunarHabitat,
  buildRadiationShelter,
  buildSolarArray,
  groundHeightAt,
} from '../three/models';
import type { GameState, ModuleId } from '../types/game';

interface LunarSceneCanvasProps {
  gameStateRef: React.MutableRefObject<GameState>;
  onSelectModule: (moduleId: ModuleId | null) => void;
  onHoverModule: (moduleId: ModuleId | null) => void;
  focusRequestRef: React.MutableRefObject<ModuleId | 'overview' | null>;
}

const MODULE_POSITIONS: Record<ModuleId, THREE.Vector3> = {
  habitat: new THREE.Vector3(0, 0, -2.5),
  solar: new THREE.Vector3(9.5, 0, -3.5),
  greenhouse: new THREE.Vector3(-8.5, 0, 2.5),
  shelter: new THREE.Vector3(7.5, 0, 7.2),
  comms: new THREE.Vector3(-4.2, 0, -9.2),
};

const CAMERA_PRESETS: Record<ModuleId | 'overview', { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [14, 13.5, 22], target: [0, 1.4, 0] },
  habitat: { pos: [5.5, 5.8, 7.5], target: [0, 1.8, -2.2] },
  solar: { pos: [16, 6.0, 5.5], target: [9.5, 2.0, -3.5] },
  greenhouse: { pos: [-14.5, 6.2, 10.5], target: [-8.5, 1.4, 2.5] },
  shelter: { pos: [13.5, 6.0, 15.2], target: [7.5, 1.4, 7.2] },
  comms: { pos: [-10.5, 6.5, -2.5], target: [-4.2, 2.5, -9.2] },
};

// Pre-allocated scratch vectors for zero-GC render loop
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();

export function LunarSceneCanvas({
  gameStateRef,
  onSelectModule,
  onHoverModule,
  focusRequestRef,
}: LunarSceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectModule);
  const onHoverRef = useRef(onHoverModule);
  onSelectRef.current = onSelectModule;
  onHoverRef.current = onHoverModule;

  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('3D viewport unavailable in this browser context.');
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080f);
    scene.fog = new THREE.FogExp2(0x06080f, 0.0082);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.2, 260);
    camera.position.set(14, 13.5, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = 0.22;
    controls.target.set(0, 1.4, 0);

    let cameraTransitionActive = false;
    controls.addEventListener('start', () => {
      cameraTransitionActive = false;
    });

    // 3-point warm/cool studio & solar lighting
    const hemiLight = new THREE.HemisphereLight(0x4b749f, 0x1a1e29, 0.65);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.35);
    sunLight.position.set(22, 26, 16);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.6);
    rimLight.position.set(-20, 12, -22);
    scene.add(rimLight);

    // Materials & Models
    const mats = createLunarMaterialLibrary(
      renderer.capabilities.getMaxAnisotropy(),
      isSoftwareGl,
    );

    const env = buildLunarEnvironment(scene, mats, isSoftwareGl);

    const habitat = buildLunarHabitat(mats);
    habitat.group.position.copy(MODULE_POSITIONS.habitat);
    scene.add(habitat.group);

    const solar = buildSolarArray(mats);
    solar.group.position.copy(MODULE_POSITIONS.solar);
    scene.add(solar.group);

    const greenhouse = buildGreenhouse(mats);
    greenhouse.group.position.copy(MODULE_POSITIONS.greenhouse);
    scene.add(greenhouse.group);

    const shelter = buildRadiationShelter(mats);
    shelter.group.position.copy(MODULE_POSITIONS.shelter);
    shelter.group.rotation.y = -0.45;
    scene.add(shelter.group);

    const comms = buildCommsArray(mats);
    comms.group.position.copy(MODULE_POSITIONS.comms);
    scene.add(comms.group);

    // Selection ring on ground
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const selectionRing = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.15, 36), ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.04;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // 3 Astronaut crew members
    const astronauts = [
      buildAstronaut(mats, 0xf97316, 0.0),
      buildAstronaut(mats, 0x06b6d4, 2.1),
      buildAstronaut(mats, 0x22c55e, 4.2),
    ];
    const patrolRoutes: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(-4.0, 0, 2.0), new THREE.Vector3(4.5, 0, 1.5)],
      [new THREE.Vector3(6.2, 0, -1.2), new THREE.Vector3(3.0, 0, -6.5)],
      [new THREE.Vector3(-5.2, 0, -4.5), new THREE.Vector3(-5.8, 0, 0.2)],
    ];
    astronauts.forEach((astro, idx) => {
      astro.homePos.copy(patrolRoutes[idx][0]);
      astro.patrolTarget.copy(patrolRoutes[idx][1]);
      astro.group.position.copy(astro.homePos);
      scene.add(astro.group);
    });

    // Pooled solar particle storm + sparks particle system
    const stormCount = 240;
    const stormPositions = new Float32Array(stormCount * 3);
    for (let i = 0; i < stormCount; i++) {
      stormPositions[i * 3] = (Math.random() - 0.5) * 44;
      stormPositions[i * 3 + 1] = 1 + Math.random() * 18;
      stormPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const stormGeo = new THREE.BufferGeometry();
    stormGeo.setAttribute('position', new THREE.BufferAttribute(stormPositions, 3));
    const stormMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.28,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const stormParticles = new THREE.Points(stormGeo, stormMat);
    scene.add(stormParticles);

    // Equipment malfunction spark particles
    const sparkCount = 40;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xfb923c,
      size: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkParticles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting setup (layer 1 hitboxes only)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    const clickTargets = [
      habitat.group,
      solar.group,
      greenhouse.group,
      shelter.group,
      comms.group,
    ];

    let downX = 0;
    let downY = 0;
    let lastHoverTime = 0;
    let currentHovered: ModuleId | null = null;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickModule = (): ModuleId | null => {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickTargets, true);
      if (hits.length > 0 && hits[0].object.userData.moduleId) {
        return hits[0].object.userData.moduleId as ModuleId;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      if (gameStateRef.current.phase !== 'playing') return;
      updatePointer(e.clientX, e.clientY);
      const hit = pickModule();
      if (hit !== currentHovered) {
        currentHovered = hit;
        renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
        onHoverRef.current(hit);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7) return;
      if (gameStateRef.current.phase !== 'playing') return;
      updatePointer(e.clientX, e.clientY);
      const hit = pickModule();
      if (hit) {
        focusRequestRef.current = hit;
        onSelectRef.current(hit);
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL context lost. Reload page to restore 3D view.');
    };
    const onContextRestored = () => {
      setWebglError(null);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Render loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;
      const gs = gameStateRef.current;

      // Earth gentle rotation
      env.earth.rotation.y += dt * 0.025;

      // Camera preset handling
      if (focusRequestRef.current) {
        const preset = CAMERA_PRESETS[focusRequestRef.current];
        _camGoal.set(preset.pos[0], preset.pos[1], preset.pos[2]);
        _lookGoal.set(preset.target[0], preset.target[1], preset.target[2]);
        cameraTransitionActive = true;
        focusRequestRef.current = null;
      }

      if (gs.phase === 'title') {
        // Cinematic slow orbit on title screen
        const angle = elapsed * 0.12;
        camera.position.x = Math.sin(angle) * 23;
        camera.position.z = Math.cos(angle) * 23;
        camera.position.y = 11.5 + Math.sin(elapsed * 0.25) * 1.2;
        controls.target.set(0, 1.5, 0);
      } else if (cameraTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, 4.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _lookGoal.x, 5.0, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _lookGoal.y, 5.0, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _lookGoal.z, 5.0, dt);
        if (camera.position.distanceTo(_camGoal) < 0.08) {
          cameraTransitionActive = false;
        }
      }

      controls.update();

      // Sun angle subtly shifts across lunar day
      const sunProgress = (gs.shiftHour - 6) / 16;
      sunLight.position.x = 24 - sunProgress * 18;
      sunLight.position.y = 22 + Math.sin(sunProgress * Math.PI) * 8;

      // Habitat fan & window lights
      if (gs.lifeSupportActive && gs.power > 4) {
        habitat.fanMesh.rotation.y += dt * 5.5;
        habitat.windowMat.emissive.setHex(gs.oxygen < 25 ? 0xf59e0b : 0x38bdf8);
        habitat.windowMat.emissiveIntensity = gs.power < 15 ? 0.35 : 1.35;
      } else {
        habitat.windowMat.emissive.setHex(0xef4444);
        habitat.windowMat.emissiveIntensity = 0.5;
      }

      // Solar panel tracking or malfunction droop
      const solarFailed = gs.equipment.solar.failed;
      const targetTilt = solarFailed ? -0.32 : gs.solarActive ? 0.38 + Math.sin(elapsed * 0.4) * 0.06 : 0.02;
      solar.trackerGroup.rotation.x = THREE.MathUtils.damp(
        solar.trackerGroup.rotation.x,
        targetTilt,
        3.5,
        dt,
      );
      solar.beaconMat.emissive.setHex(
        solarFailed ? 0xef4444 : gs.solarActive ? 0x22c55e : 0xf59e0b,
      );

      // Greenhouse plant growth & grow lights
      const plantScale = 0.25 + (gs.cropGrowth / 100) * 1.15;
      greenhouse.plantGroup.scale.y = THREE.MathUtils.damp(
        greenhouse.plantGroup.scale.y,
        plantScale,
        4.0,
        dt,
      );
      greenhouse.growLightMat.emissiveIntensity =
        gs.greenhouseLightsOn && gs.power > 5 ? 1.5 : 0.05;

      // Comms dish scan
      comms.dishPivot.rotation.y = Math.sin(elapsed * 0.35) * 0.45;
      comms.scannerBar.rotation.y += dt * 1.8;

      // Shelter & Radiation Storm Alert Effects
      const stormActive = gs.day3WarningActive || gs.day5StormActive;
      shelter.beaconMat.emissive.setHex(stormActive ? 0xf59e0b : 0x22d3ee);
      shelter.beaconMat.emissiveIntensity = stormActive
        ? 1.2 + Math.abs(Math.sin(elapsed * 5.0)) * 1.4
        : 1.0;

      // Storm particle shower
      const targetStormOpacity = stormActive ? 0.72 : 0.0;
      stormMat.opacity = THREE.MathUtils.damp(stormMat.opacity, targetStormOpacity, 3.0, dt);
      if (stormMat.opacity > 0.02) {
        const arr = stormGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < stormCount; i++) {
          arr[i * 3 + 1] -= dt * 11.5;
          arr[i * 3] -= dt * 3.5;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3 + 1] = 17 + Math.random() * 4;
            arr[i * 3] = (Math.random() - 0.5) * 44;
          }
        }
        stormGeo.attributes.position.needsUpdate = true;
      }

      // Equipment malfunction sparks
      const failedList = Object.values(gs.equipment).filter((e) => e.failed);
      if (failedList.length > 0) {
        sparkMat.opacity = 0.85;
        const origin = MODULE_POSITIONS[failedList[0].moduleId];
        const sArr = sparkGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < sparkCount; i++) {
          const t = (elapsed * 2.2 + i * 0.19) % 1;
          sArr[i * 3] = origin.x + Math.sin(i * 1.7) * t * 1.6;
          sArr[i * 3 + 1] = 1.6 + t * 1.8 - t * t * 1.9;
          sArr[i * 3 + 2] = origin.z + Math.cos(i * 2.3) * t * 1.6;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      } else {
        sparkMat.opacity = 0;
      }

      // Selection / Hover highlight ring
      const highlightId = gs.selectedModule || gs.hoveredModule;
      if (highlightId && gs.phase === 'playing') {
        const p = MODULE_POSITIONS[highlightId];
        selectionRing.visible = true;
        selectionRing.position.x = p.x;
        selectionRing.position.z = p.z;
        ringMat.color.setHex(gs.selectedModule ? 0x22d3ee : 0xf59e0b);
      } else {
        selectionRing.visible = false;
      }

      // Animate Astronauts (walk between stations or enter shelter/habitat)
      astronauts.forEach((astro, idx) => {
        const route = patrolRoutes[idx];
        let dest = route[Math.floor((elapsed * 0.14 + idx) % 2)];
        let hiding = false;

        if (gs.shelterPosture === 'shelter') {
          dest = _vecB.set(
            MODULE_POSITIONS.shelter.x - 1.1,
            0,
            MODULE_POSITIONS.shelter.z + 3.4,
          );
          hiding = astro.group.position.distanceTo(dest) < 1.3;
        } else if (gs.shelterPosture === 'habitat_hold') {
          dest = _vecB.set(
            MODULE_POSITIONS.habitat.x,
            0,
            MODULE_POSITIONS.habitat.z + 3.0,
          );
          hiding = astro.group.position.distanceTo(dest) < 1.3;
        }

        astro.group.visible = !hiding;
        if (!hiding) {
          _vecA.subVectors(dest, astro.group.position);
          _vecA.y = 0;
          const dist = _vecA.length();
          if (dist > 0.25) {
            _vecA.normalize();
            const walkSpeed = gs.phase === 'playing' ? 1.55 * Math.max(1, gs.simSpeed) : 1.0;
            astro.group.position.x += _vecA.x * walkSpeed * dt;
            astro.group.position.z += _vecA.z * walkSpeed * dt;
            astro.group.position.y = groundHeightAt(astro.group.position.x, astro.group.position.z);
            const targetYaw = Math.atan2(_vecA.x, _vecA.z);
            astro.group.rotation.y = targetYaw;

            const stride = Math.sin(elapsed * 5.2 + astro.phaseOffset);
            astro.leftLeg.rotation.x = stride * 0.48;
            astro.rightLeg.rotation.x = -stride * 0.48;
            astro.leftArm.rotation.x = -stride * 0.35;
            astro.rightArm.rotation.x = stride * 0.35;
          } else {
            astro.leftLeg.rotation.x = THREE.MathUtils.damp(astro.leftLeg.rotation.x, 0, 6, dt);
            astro.rightLeg.rotation.x = THREE.MathUtils.damp(astro.rightLeg.rotation.x, 0, 6, dt);
            astro.leftArm.rotation.x = THREE.MathUtils.damp(astro.leftArm.rotation.x, 0, 6, dt);
            astro.rightArm.rotation.x = THREE.MathUtils.damp(astro.rightArm.rotation.x, 0, 6, dt);
          }
        }
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      envTarget.dispose();
      mats.dispose();
      ringMat.dispose();
      stormGeo.dispose();
      stormMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, [focusRequestRef, gameStateRef]);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#07090E] text-slate-300 p-6 text-center">
        <div className="max-w-md space-y-2 border border-slate-800 bg-slate-900/90 p-6 rounded-xl">
          <p className="text-base font-semibold text-white">{webglError}</p>
          <p className="text-sm text-slate-400">
            Please enable hardware acceleration or use a WebGL-capable browser to view the 3D lunar base.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full relative" />;
}
