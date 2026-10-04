import "./style.css";

import {
  Matrix4,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  IcosahedronGeometry,
  LoadingManager,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RectAreaLight,
  Scene,
  TextureLoader,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import {
  EffectComposer,
  OrbitControls,
  RenderPass,
  TeapotGeometry,
  RectAreaLightHelper,
  RectAreaLightUniformsLib,
} from "three/examples/jsm/Addons.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import GUI from "lil-gui";

import { computeMeshNormal, GetSceneBounds } from "./utils";
import { GetToonMaterial } from "./material/Toon";
import { Materials } from "./material/Scene.materials";
import { GetToonPass } from "./postprocessing/ToonPass";
import { CaptureNormals } from "./RT/normal.rt";
import { CreateAudio } from "./audio/audio";
import { Matrix3 } from "three";
import { ArrowHelper } from "three";

RectAreaLightUniformsLib.init();

// ============================================================
// CONSTANTS
// ============================================================

const ANIMATION_FPS = 24; // match your Blender export FPS
const TYPING_VOLUME = 0.3;
const MONITOR_LIGHT_OFFSET = 0.005;

/**
 * Character animation timeline, in Blender frames.
 * Each phase lasts until its `endFrame`; anything after the last one is IDLE_FINAL.
 */
const TIMELINE = [
  { name: "CODING_PHASE_1", endFrame: 50, typing: true },
  { name: "MOVING_CHAIR_BACK", endFrame: 64 },
  { name: "IDLE_STILL_1", endFrame: 98 },
  { name: "MOVING_CHAIR_FORWARD", endFrame: 108 },
  { name: "CODING_PHASE_2", endFrame: 158, typing: true },
  { name: "MOVING_CHAIR_BACK_2", endFrame: 172 },
  { name: "IDLE_STILL_2", endFrame: 204 },
  { name: "MOVING_CHAIR_FORWARD_2", endFrame: 218 },
].map((phase) => ({ ...phase, endTime: phase.endFrame / ANIMATION_FPS }));

const FINAL_PHASE = { name: "IDLE_FINAL", typing: false };

// ============================================================
// GUI HELPERS
// ============================================================

/**
 * lil-gui edits raw RGB values, which look wrong with three's color management.
 * Bind a hex-string proxy instead and write back through Color.set().
 */
function addColorControl(folder, target, prop, label) {
  const proxy = { value: `#${target[prop].getHexString()}` };

  return folder
    .addColor(proxy, "value")
    .name(label)
    .onChange((value) => target[prop].set(value));
}

// ============================================================
// CORE SETUP (renderer, stats, scene, camera, controls)
// ============================================================

function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  return renderer;
}

function createStats() {
  const stats = new Stats();

  stats.showPanel(0); // 0 = FPS
  Object.assign(stats.dom.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    zIndex: "9999",
  });
  document.body.appendChild(stats.dom);

  return stats;
}

function createCamera() {
  const camera = new PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  camera.position.set(2.7, 1.7, -1.8);
  camera.lookAt(new Vector3(4, 0, -2));

  return camera;
}

function createControls(camera, canvas) {
  const controls = new OrbitControls(camera, canvas);

  controls.target.set(-0.5, 0, 0);
  controls.update();

  return controls;
}

// ============================================================
// ASSET LOADING
// ============================================================

function createLoaders() {
  const manager = new LoadingManager();

  const draco = new DRACOLoader(manager);
  draco.setDecoderPath("/draco/");
  draco.setDecoderConfig({ type: "wasm" });

  const gltf = new GLTFLoader(manager);
  gltf.setDRACOLoader(draco);

  return { manager, gltf, texture: new TextureLoader(manager) };
}

// ============================================================
// TEST OBJECTS (hidden by default)
// ============================================================

function createTestObjects(inkMap) {
  const toon = (color) => GetToonMaterial({ color }, { InkMap: inkMap });

  const pot = new Mesh(new TeapotGeometry(1), toon("skyblue"));
  pot.position.set(4, 0, -2);

  const metaBall = new Mesh(new IcosahedronGeometry(1, 10), toon("yellow"));
  metaBall.position.set(-4, 0, -2);

  const torus = new Mesh(
    new TorusKnotGeometry(1.3, 0.3, 100, 100),
    toon("limegreen"),
  );

  const ground = new Mesh(
    new PlaneGeometry(100, 100),
    new MeshStandardMaterial({ color: "white" }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.2;
  ground.receiveShadow = true;

  [pot, metaBall, torus].forEach((mesh) => (mesh.castShadow = true));

  const all = [ground, metaBall, torus, pot];
  all.forEach((object) => (object.visible = false));

  return { pot, torus, all };
}

// ============================================================
// MODEL MATERIALS
// ============================================================

const defaultModelMaterial = new MeshPhysicalMaterial({
  color: "gray",
  roughness: 1,
  metalness: 0,
});

function applyModelMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;

    if (node.name === "desk_focus_sphere") {
      node.material = new MeshBasicMaterial({ color: "purple" });
      return;
    }

    node.material = Materials[node.name] ?? defaultModelMaterial;

    if (node.name.includes("keyboard_key")) {
      node.material = Materials.keyboard_key;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

// ============================================================
// LIGHTS
// ============================================================

const DEBUG_MONITOR_NORMALS = true; // red arrows show each light's emit direction

/**
 * World-space normal of a screen mesh, flipped to face `referencePoint`
 * (the desk/room) if the mesh normal points the wrong way.
 */
function getScreenWorldNormal(screen, referencePoint) {
  screen.updateWorldMatrix(true, false);

  // Sum vertex normals (flat plane => all identical)
  const normals = screen.geometry.attributes.normal;
  const local = new Vector3();
  const v = new Vector3();

  for (let i = 0; i < normals.count; i++) {
    local.add(v.fromBufferAttribute(normals, i));
  }
  if (local.lengthSq() < 1e-6) local.set(0, 0, 1); // fallback

  // Normal matrix handles non-uniform / negative scale correctly
  const world = local
    .normalize()
    .applyMatrix3(new Matrix3().getNormalMatrix(screen.matrixWorld))
    .normalize();

  if (referencePoint) {
    const center = new Vector3().setFromMatrixPosition(screen.matrixWorld);
    if (world.dot(referencePoint.clone().sub(center)) < 0) world.negate();
  }

  return world;
}

/**
 * Screen center and width/height in world units, independent of rotation.
 * The two largest local extents are the screen plane.
 */
/**
 * Center, size and orientation of a screen mesh in world space,
 * built from the mesh's own axes so rotation/roll always matches.
 */
function getScreenFrame(screen, normal) {
  screen.updateWorldMatrix(true, false);

  const { geometry, matrixWorld } = screen;
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const size = box.getSize(new Vector3());
  const localSize = [size.x, size.y, size.z];

  // World direction + world-space extent for each local axis
  const axes = [0, 1, 2].map((i) => {
    const column = new Vector3().setFromMatrixColumn(matrixWorld, i);
    const scale = column.length();

    return { dir: column.divideScalar(scale), extent: localSize[i] * scale };
  });

  // Thinnest axis = screen depth; the other two span the screen plane
  const [, planeA, planeB] = [...axes].sort((a, b) => a.extent - b.extent);

  // The in-plane axis closest to world up is the screen's height
  const [heightAxis, widthAxis] =
    Math.abs(planeA.dir.y) >= Math.abs(planeB.dir.y)
      ? [planeA, planeB]
      : [planeB, planeA];

  // RectAreaLight emits along its local -Z, so +Z = -normal
  const z = normal.clone().negate();
  const y = heightAxis.dir
    .clone()
    .addScaledVector(normal, -heightAxis.dir.dot(normal)) // keep it perpendicular
    .normalize();
  const x = new Vector3().crossVectors(y, z);

  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, z),
  );

  // Geometry center rather than object origin (pivots are often offset)
  const center = screen.localToWorld(box.getCenter(new Vector3()));

  return {
    center,
    quaternion,
    width: widthAxis.extent,
    height: heightAxis.extent,
  };
}

function createMonitorLight(screen, scene, referencePoint) {
  const normal = getScreenWorldNormal(screen, referencePoint);
  const { center, quaternion, width, height } = getScreenFrame(screen, normal);

  const light = new RectAreaLight(new Color("white"), 10, width, height);

  light.position.copy(center).addScaledVector(normal, MONITOR_LIGHT_OFFSET);
  light.quaternion.copy(quaternion);
  light.updateMatrixWorld(true);

  const helper = new RectAreaLightHelper(light);
  scene.add(light, helper);

  if (DEBUG_MONITOR_NORMALS) {
    scene.add(new ArrowHelper(normal, light.position, 0.5, 0xff0000));
    console.log(screen.name, { width, height });
  }

  return { screen, light, helper };
}

function setupMonitorLights(model, scene, gui) {
  const screens = ["monitor_screen", "monitor_2_screen"].map((name) =>
    model.getObjectByName(name),
  );

  if (screens.some((screen) => !screen)) {
    console.warn("Monitor screen(s) not found.");
    return [];
  }

  // Screens should face the desk, so use it as the "inside the room" reference
  const deskFocus = model.getObjectByName("desk_focus_sphere");
  const referencePoint = deskFocus?.getWorldPosition(new Vector3());

  const monitors = screens.map((screen) =>
    createMonitorLight(screen, scene, referencePoint),
  );

  monitors.forEach(({ light }, index) => {
    const folder = gui.addFolder(`Monitor ${index + 1} Light`);

    addColorControl(folder, light, "color", "Color");
    folder.add(light, "intensity", 0, 10, 0.001).name("Intensity");
  });

  return monitors;
}

function setupDirectionalLight(model, scene, gui) {
  const deskFocus = model.getObjectByName("desk_focus_sphere");
  deskFocus.visible = false;

  const light = new DirectionalLight(0xffffff, 1);
  light.position.set(-4, 4, -3);
  light.target = deskFocus;

  const helper = new DirectionalLightHelper(light, 0.1, new Color("red"));

  gui
    .addFolder("Lighting")
    .close()
    .add(light, "intensity", 0, 4, 0.001)
    .name("Directional Light");

  scene.add(light, helper);
}

// ============================================================
// CHARACTER ANIMATION
// ============================================================

function createCharacterAnimation(glb) {
  const mixer = new AnimationMixer(glb.scene);

  const findClip = (name) => glb.animations.find((clip) => clip.name === name);

  const chairAction = mixer.clipAction(findClip("Animation"));
  const codingAction = mixer.clipAction(findClip("character_coding_animation"));

  chairAction.play();
  codingAction.play();

  return { mixer, codingAction };
}

function getTimelinePhase(time) {
  return TIMELINE.find((phase) => time < phase.endTime) ?? FINAL_PHASE;
}

/**
 * Tracks the current timeline phase and fires onTypingChange
 * only when the typing state actually flips.
 */
function createTimelineTracker({ onTypingChange }) {
  let currentPhase = "";
  let isTyping = false;

  return function update(time) {
    const phase = getTimelinePhase(time);

    if (phase.name === currentPhase) return;
    currentPhase = phase.name;

    const typing = Boolean(phase.typing);

    if (typing !== isTyping) {
      isTyping = typing;
      onTypingChange(isTyping);
    }
  };
}

// ============================================================
// MAIN
// ============================================================

const canvas = document.querySelector("canvas");
const gui = new GUI();

const renderer = createRenderer(canvas);
const stats = createStats();
const scene = new Scene();
const camera = createCamera();

createControls(camera, canvas);
GetSceneBounds(renderer, camera);

scene.background = new Color("#0a0a0a");
addColorControl(gui, scene, "background", "Scene Background");

// ---- Assets ------------------------------------------------

const loaders = createLoaders();
const appleLogoTexture = loaders.texture.load("/textures/applelogo.png");
const inkMap = loaders.texture.load("/textures/ink.jpg");
const scratchNoiseTexture = loaders.texture.load("/textures/noise_scratch.png");

const testObjects = createTestObjects(inkMap);
scene.add(...testObjects.all);

// ---- Audio -------------------------------------------------

const howl = CreateAudio();
howl.setVolumes(0, 0);

const updateTimeline = createTimelineTracker({
  onTypingChange: (isTyping) => {
    howl.setVolumes(isTyping ? TYPING_VOLUME : 0, isTyping ? TYPING_VOLUME : 0);
  },
});

// ---- Post-processing --------------------------------------

const postprocessing = { enabled: true };
gui.add(postprocessing, "enabled").name("Sketch Shader");

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const toonPass = GetToonPass(composer, gui, scratchNoiseTexture);

// ---- Scene model ------------------------------------------

let character = null;

loaders.gltf.load("/models/scene.glb", (glb) => {
  const model = glb.scene;

  character = createCharacterAnimation(glb);

  applyModelMaterials(model);

  const appleLogo = model.getObjectByName("apple_logo_plane");
  appleLogo.material.uniforms.uMap.value = appleLogoTexture;
  appleLogo.scale.setScalar(0.1);

  // Must be in the scene before world-space calculations
  scene.add(model);
  model.updateMatrixWorld(true);

  setupDirectionalLight(model, scene, gui);
  setupMonitorLights(model, scene, gui);
});

// ---- Render loop ------------------------------------------

const clock = new Clock();

function animate() {
  stats.begin();

  const dt = clock.getDelta();

  testObjects.pot.rotation.y += dt;
  testObjects.torus.rotation.x += dt;
  testObjects.torus.rotation.y += dt;

  if (character) {
    updateTimeline(character.codingAction.time);
    character.mixer.update(dt);
  }

  const normalTexture = CaptureNormals(
    scene,
    camera,
    renderer,
    window.innerWidth,
    window.innerHeight,
  );

  toonPass.update(dt, normalTexture);

  if (postprocessing.enabled) {
    composer.render(dt);
  } else {
    renderer.render(scene, camera);
  }

  stats.end();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// ---- Resize ------------------------------------------------

window.addEventListener("resize", () => {
  const { innerWidth: width, innerHeight: height } = window;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  composer.setSize(width, height);
});