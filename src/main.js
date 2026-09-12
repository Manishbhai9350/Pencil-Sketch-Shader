import "./style.css";
import * as THREE from "three";

import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  SpotLight,
  SpotLightHelper,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
  PerspectiveCamera,
  Quaternion,
  Clock,
} from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

import {
  EffectComposer,
  OrbitControls,
  RenderPass,
  TeapotGeometry,
  RectAreaLightHelper,
} from "three/examples/jsm/Addons.js";

import Stats from "three/examples/jsm/libs/stats.module.js";

import { GetSceneBounds } from "./utils";
import { GetToonMaterial } from "./material/Toon";
import { Pane } from "tweakpane";
import { GetToonPass } from "./postprocessing/ToonPass";
import { CaptureNormals } from "./RT/normal.rt";

// ============================================================
// CONFIG
// ============================================================

const pane = new Pane();

pane.hidden = true;

const canvas = document.querySelector("canvas");

const { innerWidth, innerHeight } = window;

// ============================================================
// RENDERER
// ============================================================

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.setSize(innerWidth, innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================================
// FPS ANALYSER
// ============================================================

const stats = new Stats();


stats.showPanel(0); // 0 = FPS
// document.body.appendChild(stats.dom);

stats.dom.style.position = "fixed";
stats.dom.style.left = "0px";
stats.dom.style.top = "0px";
stats.dom.style.zIndex = "9999";

// ============================================================
// SCENE
// ============================================================

const scene = new Scene();

scene.background = new Color("#ffffff");

// ============================================================
// CAMERA
// ============================================================

const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 1000);

camera.position.set(2.3, 2, 3.4);

camera.lookAt(new Vector3(4, 0, -2));

// ============================================================
// LOADERS
// ============================================================

const Manager = new THREE.LoadingManager();

const Draco = new DRACOLoader(Manager);

const GLB = new GLTFLoader(Manager);

const TextureLoader = new THREE.TextureLoader(Manager);

Draco.setDecoderPath("/draco/");

Draco.setDecoderConfig({
  type: "wasm",
});

GLB.setDRACOLoader(Draco);

// ============================================================
// CONTROLS
// ============================================================

const Controls = new OrbitControls(camera, canvas);

Controls.target.set(-0.5, 0, 0);

Controls.update();

// ============================================================
// SCENE BOUNDS
// ============================================================

const { width: SceneWidth, height: SceneHeight } = GetSceneBounds(
  renderer,
  camera,
);

// ============================================================
// TEXTURES
// ============================================================

const InkMap = TextureLoader.load("/textures/ink.jpg");

const ScratchNoiseTexture = TextureLoader.load("/textures/noise_scratch.png");

// ============================================================
// TEST OBJECTS
// ============================================================

const PotMaterial = GetToonMaterial(
  {
    color: "skyblue",
  },
  {
    InkMap,
  },
);

const Pot = new Mesh(new TeapotGeometry(1), PotMaterial);

Pot.castShadow = true;

const Ground = new Mesh(
  new PlaneGeometry(100, 100),

  new MeshStandardMaterial({
    color: "white",
  }),
);

Ground.rotation.x = -Math.PI / 2;

Ground.position.y = -2.2;

Ground.receiveShadow = true;

const MetaBallMaterial = GetToonMaterial(
  {
    color: "yellow",
  },
  {
    InkMap,
  },
);

const MetaBall = new Mesh(new IcosahedronGeometry(1, 10), MetaBallMaterial);

MetaBall.position.set(-4, 0, -2);

MetaBall.castShadow = true;

const Torus = new Mesh(
  new TorusKnotGeometry(1.3, 0.3, 100, 100),

  GetToonMaterial(
    {
      color: "limegreen",
    },
    {
      InkMap,
    },
  ),
);

Torus.castShadow = true;

// Hide test objects

Pot.visible = false;
Ground.visible = false;
Torus.visible = false;
MetaBall.visible = false;

Pot.position.set(4, 0, -2);

scene.add(Ground, MetaBall, Torus, Pot);

// ============================================================
// AMBIENT LIGHT
// ============================================================

const Ambient = new AmbientLight(0xffffff, 1);

scene.add(Ambient);

// ============================================================
// DIRECTIONAL LIGHT
// ============================================================

const CenterBallTarget = new Mesh(
  new IcosahedronGeometry(0.1, 1),

  new MeshBasicMaterial({
    color: "yellow",
  }),
);

CenterBallTarget.position.set(-0.5, 0, 0);

CenterBallTarget.visible = true;

const Directional = new DirectionalLight(0xffffff, 6.5);

Directional.position.set(4, 1, 3);

Directional.target = CenterBallTarget;

Directional.castShadow = true;

const DirectionalHelper = new DirectionalLightHelper(Directional, 0.1, "red");

scene.add(Directional, DirectionalHelper, CenterBallTarget);

// ============================================================
// DESK LAMP SPOTLIGHT
// ============================================================

const LampLight = new SpotLight(0xffffff, 4, 5, Math.PI / 5, 0.5, 1);

LampLight.castShadow = true;

// Improve shadow quality

LampLight.shadow.mapSize.set(1024, 1024);

LampLight.shadow.bias = -0.0001;

const LampLightHelper = new SpotLightHelper(LampLight, "purple");

// ============================================================
// MONITOR RECT AREA LIGHT
// ============================================================

const MonitorLight = new RectAreaLight(0x9fc5ff, 3, 1.5, 0.8);

// ============================================================
// LIGHT DEBUG HELPERS
// ============================================================

let MonitorLightHelper = null;

// ============================================================
// LIGHT CONTROLS
// ============================================================

const LightningFolder = pane.addFolder({
  title: "Lighting",
  expanded: false,
});

LightningFolder.addBinding(LampLight, "intensity", {
  min: 0,
  max: 10,
  step: 0.001,
  label: "Lamp Light",
}).on("change", () => {
  LampLightHelper.update();
});

LightningFolder.addBinding(LampLight, "angle", {
  min: 0,
  max: Math.PI,
  step: 0.001,
  label: "Lamp Angle",
}).on("change", () => {
  LampLightHelper.update();
});

LightningFolder.addBinding(LampLight, "penumbra", {
  min: 0,
  max: 1,
  step: 0.001,
  label: "Lamp Penumbra",
}).on("change", () => {
  LampLightHelper.update();
});

LightningFolder.addBinding(Directional, "intensity", {
  min: 0,
  max: 6,
  step: 0.001,
  label: "Directional Light",
});

// ============================================================
// ADD LIGHTS
// ============================================================

scene.add(LampLight, LampLight.target, LampLightHelper, MonitorLight);

// ============================================================
// MODEL
// ============================================================

const StanMat = new MeshStandardMaterial({
  color: "gray",
});

let Model = null;
let ModelCamera = null;

// ============================================================
// GLB LIGHT MARKERS
// ============================================================

let LampNormalStart = null;
let LampNormalEnd = null;
let MonitorScreen = null;
let DeskFocusSphere = null;

// ============================================================
// WORLD SPACE TRANSFORM DATA
// ============================================================

const LampStartWorld = new Vector3();

const LampEndWorld = new Vector3();

const LampDirection = new Vector3();

const MonitorWorldPosition = new Vector3();

const MonitorWorldScale = new Vector3();

const MonitorWorldQuaternion = new Quaternion();

// ============================================================
// SETUP LAMP LIGHT
// ============================================================

function SetupLampLight() {
  if (!LampNormalStart || !LampNormalEnd) {
    console.warn("Lamp normal markers not found.");

    return;
  }

  // ----------------------------------------------------------
  // WORLD POSITIONS
  // ----------------------------------------------------------

  LampNormalStart.getWorldPosition(LampStartWorld);

  LampNormalEnd.getWorldPosition(LampEndWorld);

  // ----------------------------------------------------------
  // DIRECTION
  // ----------------------------------------------------------

  LampDirection.subVectors(LampEndWorld, LampStartWorld).normalize();

  // ----------------------------------------------------------
  // SPOTLIGHT POSITION
  // ----------------------------------------------------------

  LampLight.position.copy(LampStartWorld).addScaledVector(LampDirection, 0.05);

  // ----------------------------------------------------------
  // SPOTLIGHT TARGET
  // ----------------------------------------------------------

  LampLight.target.position
    .copy(LampEndWorld)
    .addScaledVector(LampDirection, 1);

  // Force matrix update

  LampLight.target.updateMatrixWorld(true);

  LampLight.updateMatrixWorld(true);

  LampLightHelper.update();

  console.log("Lamp position:", LampLight.position);

  console.log("Lamp direction:", LampDirection);
}

// ============================================================
// SETUP MONITOR LIGHT
// ============================================================

function SetupMonitorLight() {
  if (!MonitorScreen) {
    console.warn("monitor_screen not found.");

    return;
  }

  // ----------------------------------------------------------
  // WORLD POSITION
  // ----------------------------------------------------------

  MonitorScreen.getWorldPosition(MonitorWorldPosition);

  MonitorLight.position.copy(MonitorWorldPosition);

  // ----------------------------------------------------------
  // WORLD SCALE
  // ----------------------------------------------------------

  MonitorScreen.getWorldScale(MonitorWorldScale);

  // ----------------------------------------------------------
  // WORLD QUATERNION
  // ----------------------------------------------------------

  MonitorScreen.getWorldQuaternion(MonitorWorldQuaternion);

  // ----------------------------------------------------------
  // SCREEN NORMAL
  // ----------------------------------------------------------

  /*
    RectAreaLight emits from
    its LOCAL +Z direction.

    We first take the monitor's
    local +Z and transform it
    into world space.
  */

  const MonitorNormal = new Vector3(0, 0, 1);

  MonitorNormal.applyQuaternion(MonitorWorldQuaternion).normalize();

  // ----------------------------------------------------------
  // LIGHT ROTATION
  // ----------------------------------------------------------

  const MonitorTarget = MonitorWorldPosition.clone().add(MonitorNormal);

  MonitorLight.lookAt(MonitorTarget);

  // ----------------------------------------------------------
  // SCREEN SIZE
  // ----------------------------------------------------------

  const ScreenBox = new Box3();

  ScreenBox.setFromObject(MonitorScreen);

  const ScreenSize = new Vector3();

  ScreenBox.getSize(ScreenSize);

  /*
    This assumes the monitor screen
    is primarily X/Y oriented.

    If the light size looks wrong,
    manually tune these values.
  */

  MonitorLight.width = ScreenSize.x;

  MonitorLight.height = ScreenSize.y;

  MonitorLight.updateMatrixWorld(true);

  MonitorLight.rotation.set(0, 0.02, 0);
  MonitorLight.position.z -= 0.005;

  if (!MonitorLightHelper) {
    MonitorLightHelper = new RectAreaLightHelper(MonitorLight);

    scene.add(MonitorLightHelper);
  }

  console.log("Monitor position:", MonitorLight.position);

  console.log("Monitor normal:", MonitorNormal);

  console.log("Monitor size:", MonitorLight.width, MonitorLight.height);

  const MonitorLightPane = pane.addFolder({
    title: "Monitor Light",
    expanded: true,
  });

  MonitorLightPane.addBinding(MonitorLight, "color", {
    color: {
      type: "float",
    },
    label: "Color",
  });
  MonitorLightPane.addBinding(MonitorLight, "intensity", {
    min: 0,
    max: 14,
    step: 0.001,
    label: "Intensity",
  });
}

// ============================================================
// SETUP ALL LIGHTS
// ============================================================

function SetupLights() {
  SetupLampLight();

  SetupMonitorLight();
}

// ============================================================
// LOAD GLB
// ============================================================

GLB.load(
  "/models/scene.glb",

  (glb) => {
    Model = glb.scene;

    ModelCamera = glb.cameras[0];

    // --------------------------------------------------------
    // FIND OBJECTS
    // --------------------------------------------------------

    LampNormalStart = Model.getObjectByName("lamp_normal_start");

    LampNormalEnd = Model.getObjectByName("lamp_normal_end");

    MonitorScreen = Model.getObjectByName("monitor_screen");

    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    console.log("Lamp Start:", LampNormalStart);

    console.log("Lamp End:", LampNormalEnd);

    console.log("Monitor Screen:", MonitorScreen);

    console.log(MonitorScreen.quaternion);

    // --------------------------------------------------------
    // MODEL MATERIALS
    // --------------------------------------------------------

    Model.traverse((Node) => {
      if (!Node.isMesh) return;

      // ----------------------------------------------------
      // DESK FOCUS SPHERE
      // ----------------------------------------------------

      if (Node.name === "desk_focus_sphere") {
        Node.material = new MeshBasicMaterial({
          color: "purple",
        });

        DeskFocusSphere = Node;

        return;
      }

      // ----------------------------------------------------
      // NORMAL MESH
      // ----------------------------------------------------

      Node.material = StanMat;

      Node.castShadow = true;

      Node.receiveShadow = true;
    });

    // --------------------------------------------------------
    // ADD MODEL BEFORE WORLD-SPACE CALCULATIONS
    // --------------------------------------------------------

    scene.add(Model);

    // --------------------------------------------------------
    // UPDATE MODEL MATRICES
    // --------------------------------------------------------

    Model.updateMatrixWorld(true);

    // --------------------------------------------------------
    // SETUP LIGHTS
    // --------------------------------------------------------

    SetupLights();
  },
);

// ============================================================
// POST PROCESSING
// ============================================================

let Postprocessing = {
  enabled: true,
};

pane.addBinding(Postprocessing, "enabled", {
  label: "Sketch Shader",
});

const composer = new EffectComposer(renderer);

composer.addPass(new RenderPass(scene, camera));

const ToonPass = GetToonPass(composer, pane, ScratchNoiseTexture);

// ============================================================
// CLOCK
// ============================================================

const clock = new Clock();

let PreviousTime = clock.getElapsedTime();

// ============================================================
// ANIMATION
// ============================================================

function Animate() {
  stats.begin();

  // ----------------------------------------------------------
  // TIME
  // ----------------------------------------------------------

  const CurrentTime = clock.getElapsedTime();

  const DT = CurrentTime - PreviousTime;

  PreviousTime = CurrentTime;

  // ----------------------------------------------------------
  // TEST ANIMATION
  // ----------------------------------------------------------

  Pot.rotation.y += DT;

  Torus.rotation.x += DT;

  Torus.rotation.y += DT;

  // ----------------------------------------------------------
  // CAPTURE NORMALS
  // ----------------------------------------------------------

  const SceneNormalTexture = CaptureNormals(
    scene,
    camera,
    renderer,
    innerWidth,
    innerHeight,
  );

  // ----------------------------------------------------------
  // TOON PASS
  // ----------------------------------------------------------

  ToonPass.update(DT, SceneNormalTexture);

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  if (Postprocessing.enabled) {
    composer.render(DT);
  } else {
    renderer.render(scene, camera);
  }

  stats.end();

  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

// ============================================================
// RESIZE
// ============================================================

function Resize() {
  const Width = window.innerWidth;

  const Height = window.innerHeight;

  camera.aspect = Width / Height;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.setSize(Width, Height);

  composer.setSize(Width, Height);
}

window.addEventListener("resize", Resize);
