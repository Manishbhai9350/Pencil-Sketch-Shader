import "./style.css";
import * as THREE from "three";

import {
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

import { computeMeshNormal, GetSceneBounds } from "./utils";
import { GetToonMaterial } from "./material/Toon";
import { Pane } from "tweakpane";
import { GetToonPass } from "./postprocessing/ToonPass";
import { CaptureNormals } from "./RT/normal.rt";
import { CircleOfConfusionMaterial } from "postprocessing";
import { Materials } from "./material/Scene.materials";

// ============================================================
// CONFIG
// ============================================================

const pane = new Pane();

pane.hidden = true;

pane.element.style.zIndex = "9999999999999999999999999";

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
document.body.appendChild(stats.dom);

stats.dom.style.position = "fixed";
stats.dom.style.left = "0px";
stats.dom.style.top = "0px";
stats.dom.style.zIndex = "9999";

// ============================================================
// SCENE
// ============================================================

const scene = new Scene();

scene.background = new Color("#0a0a0a");

pane.addBinding(scene, "background", {
  color: { type: "float" },
  label: "Scene Background",
});

// ============================================================
// CAMERA
// ============================================================

const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 1000);

camera.position.set(2.7, 1.7, -1.8);

camera.lookAt(new Vector3(4, 0, -2));

// ============================================================
// LOADERS
// ============================================================

const Manager = new THREE.LoadingManager();

const Draco = new DRACOLoader(Manager);

const GLB = new GLTFLoader(Manager);

const TextureLoader = new THREE.TextureLoader(Manager);

const AppleLogoTexture = TextureLoader.load("/textures/applelogo.png");

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
// LIGHT DEBUG HELPERS
// ============================================================

let MonitorLightHelper = null;
let MonitorLight = null;
let MonitorScreen = null;
let Monitor2Screen = null;
let Monitor2Light = null;
let DeskFocusSphere = null;

let Monitors = [];

// ============================================================
// LIGHT CONTROLS
// ============================================================

const LightningFolder = pane.addFolder({
  title: "Lighting",
  expanded: false,
});

// ============================================================
// ADD LIGHTS
// ============================================================

// ============================================================
// MODEL
// ============================================================

const StanMat = new MeshStandardMaterial({
  color: "gray",
});

let Model = null;

// ============================================================
// WORLD SPACE TRANSFORM DATA
// ============================================================

// ============================================================
// SETUP MONITOR LIGHT
// ============================================================

function SetupMonitorLight() {
  if (!Monitors[0].screen || !Monitors[1].screen) {
    console.warn("monitor_screen not found.");
    return;
  }

  Monitors[0].light = new RectAreaLight(new Color("red"), 1, 1, 1);
  Monitors[1].light = new RectAreaLight(new Color("green"), 1, 1, 1);

  // ----------------------------------------------------------
  // WORLD POSITION
  // ----------------------------------------------------------

  const Monitor1Screen = Monitors[0].screen;
  const Monitor2Screen = Monitors[1].screen;
  Monitor1Screen.getWorldPosition(Monitors[0].worldPosition);
  Monitor2Screen.getWorldPosition(Monitors[1].worldPosition);

  Monitors[0].light.position.copy(Monitors[0].worldPosition);
  Monitors[1].light.position.copy(Monitors[1].worldPosition);

  // ----------------------------------------------------------
  // WORLD SCALE
  // ----------------------------------------------------------

  Monitor1Screen.getWorldScale(Monitors[0].worldScale);
  Monitor2Screen.getWorldScale(Monitors[1].worldScale);

  // ----------------------------------------------------------
  // WORLD QUATERNION
  // ----------------------------------------------------------

  Monitor1Screen.getWorldQuaternion(Monitors[0].worldQuaternion);
  Monitor2Screen.getWorldQuaternion(Monitors[1].worldQuaternion);

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

  // const Monitor1Normal = new Vector3(0, 0, 1);
  const Monitor1Normal = computeMeshNormal(Monitor1Screen);
  const Monitor2Normal = computeMeshNormal(Monitor2Screen);

  Monitor1Normal.applyQuaternion(Monitors[0].worldQuaternion).normalize();
  Monitor2Normal.applyQuaternion(Monitors[1].worldQuaternion).normalize();

  // ----------------------------------------------------------
  // LIGHT ROTATION
  // ----------------------------------------------------------

  // Position light at the screen
  Monitors[0].light.position.copy(Monitors[0].worldPosition);
  Monitors[1].light.position.copy(Monitors[1].worldPosition);

  // Orient light to emit along the screen normal (towards the room)
  Monitors[0].light.lookAt(
    Monitors[0].worldPosition.clone().add(Monitor1Normal),
  );
  Monitors[1].light.lookAt(
    Monitors[1].worldPosition.clone().add(Monitor2Normal),
  );

  /*
    This assumes the monitor screen
    is primarily X/Y oriented.

    If the light size looks wrong,
    manually tune these values.
  */

  Monitors.map(({ screen, light, lightHelper }) => {
    // ----------------------------------------------------------
    // SCREEN SIZE
    // ----------------------------------------------------------

    const ScreenBox = new Box3();

    ScreenBox.setFromObject(screen);

    const ScreenSize = new Vector3();

    ScreenBox.getSize(ScreenSize);

    light.width = ScreenSize.x;

    light.height = ScreenSize.y;

    light.updateMatrixWorld(true);

    light.rotation.set(0, 0.02, 0);
    light.position.z -= 0.005;

    if (!lightHelper) {
      lightHelper = new RectAreaLightHelper(light);

      scene.add(lightHelper);
    }
  });

  Monitors[0].light.position.x += 0.2;

  console.log(Monitor1Normal.x,Monitor1Normal.y,Monitor1Normal.z)

  Monitors[1].light.position.x += Monitor2Normal.x * 0.002;
  Monitors[1].light.position.y += Monitor2Normal.y * 0.002;
  Monitors[1].light.position.z += Monitor2Normal.z * 0.002;

  const MonitorLightPane = pane.addFolder({
    title: "Monitor Light",
    expanded: true,
  });

  MonitorLightPane.addBinding(Monitors[0].light, "color", {
    color: {
      type: "float",
    },
    label: "Color",
  });
  MonitorLightPane.addBinding(Monitors[0].light, "intensity", {
    min: 0,
    max: 1,
    step: 0.001,
    label: "Intensity",
  });
}

// ============================================================
// SETUP ALL LIGHTS
// ============================================================

function SetupLights(model) {
  const DeskFocus = model.getObjectByName("desk_focus_sphere");

  DeskFocus.visible = false;

  const Directional1 = new DirectionalLight(0xffffff, 1);
  Directional1.position.set(-4, 4, -3);
  Directional1.target = DeskFocus;

  const Directional1Helper = new DirectionalLightHelper(
    Directional1,
    0.1,
    new Color("red"),
  );

  LightningFolder.addBinding(Directional1, "intensity", {
    min: 0,
    max: 4,
    step: 0.001,
    label: "Directional Light",
  });

  scene.add(Directional1, Directional1Helper);

  SetupMonitorLight();
}

// ============================================================
// LOAD GLB
// ============================================================

GLB.load(
  "/models/scene.glb",

  (glb) => {
    Model = glb.scene;

    // --------------------------------------------------------
    // FIND OBJECTS
    // --------------------------------------------------------

    MonitorScreen = Model.getObjectByName("monitor_screen");

    Monitors[0] = {
      screen: Model.getObjectByName("monitor_screen"),
      light: Model.getObjectByName("monitor_bar_light_light"),
      lightHelper: null,
      worldPosition: new Vector3(),
      worldScale: new Vector3(),
      worldQuaternion: new Quaternion(),
    };
    Monitors[1] = {
      screen: Model.getObjectByName("monitor_2_screen"),
      light: Model.getObjectByName("monitor_bar_light_light_2"),
      lightHelper: null,
      worldPosition: new Vector3(),
      worldScale: new Vector3(),
      worldQuaternion: new Quaternion(),
    };

    const AppleLogo = Model.getObjectByName("apple_logo_plane");

    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

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

      Node.material = StanMat;

      Node.material = Materials[Node.name] || Node.material;

      console.log(Node.name);

      if (Node.name.includes("keyboard_key")) {
        Node.material = Materials.keyboard_key;
      }

      // ----------------------------------------------------
      // NORMAL MESH
      // ----------------------------------------------------

      Node.castShadow = true;

      Node.receiveShadow = true;
    });

    AppleLogo.material.uniforms.uMap.value = AppleLogoTexture;
    const scale = 0.1;
    AppleLogo.scale.set(scale, scale, scale);

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

    SetupLights(Model);
  },
);

// ============================================================
// POST PROCESSING
// ============================================================

let Postprocessing = {
  enabled: false,
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
