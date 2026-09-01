import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { Clock } from "three";
import { GetSceneBounds } from "./utils";
import {
  EffectComposer,
  OrbitControls,
  RenderPass,
  TeapotGeometry,
} from "three/examples/jsm/Addons.js";
import { Mesh } from "three";
import { BoxGeometry } from "three";
import { MeshBasicMaterial } from "three";
import { IcosahedronGeometry } from "three";
import { Color } from "three";
import { PlaneGeometry } from "three";
import { MeshStandardMaterial } from "three";
import { DirectionalLight } from "three";
import { FogExp2 } from "three";
import { GetToonMaterial } from "./material/Toon";
import { MeshToonMaterial } from "three";
import { TorusKnotGeometry } from "three";
import { AmbientLight } from "three";
import { Pane } from "tweakpane";
import { GetToonPass } from "./postprocessing/ToonPass";
import { CaptureNormals } from "./RT/normal.rt";

const { PI } = Math;

const pane = new Pane();

// pane.hidden = true;

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  1,
  1000,
);
camera.position.z = 7;
camera.position.y = 4;

const Manager = new THREE.LoadingManager();
const Draco = new DRACOLoader(Manager);
const GLB = new GLTFLoader(Manager);
const TextureLoader = new THREE.TextureLoader(Manager);

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });
GLB.setDRACOLoader(Draco);

const Controls = new OrbitControls(camera, canvas);

const { width: SceneWidth, height: SceneHeight } = GetSceneBounds(
  renderer,
  camera,
);

// const material = new THREE.ShaderMaterial({
//   vertexShader,
//   fragmentShader,
//   uniforms: {
//     uComputed: { value: null },
//   },
// });

scene.background = new Color("#ffffff");
// scene.fog = new FogExp2("#2a2727", 0);

const InkMap = TextureLoader.load("/textures/ink.jpg");

const PotMaterial = GetToonMaterial({ color: "skyblue" }, { InkMap });

const Pot = new THREE.Mesh(new TeapotGeometry(1), PotMaterial);

Pot.castShadow = true;

const Ground = new Mesh(
  new PlaneGeometry(100, 100),
  new MeshStandardMaterial({
    color: "white",
  }),
);

scene.add(new AmbientLight(0xffffff, 0.3));
const D = new DirectionalLight(0xffffff, 2.5);
D.position.set(10, 10, 10);
D.castShadow = true;
scene.add(D);

const MetaBallMaterial = GetToonMaterial({ color: "yellow" }, { InkMap });

const MetaBall = new Mesh(new IcosahedronGeometry(1, 10), MetaBallMaterial);

const Torus = new Mesh(
  new TorusKnotGeometry(1.3, 0.3, 100, 100),
  GetToonMaterial({ color: "limegreen" }, { InkMap }),
  // new MeshStandardMaterial({color:'red'})
);

Torus.position.set(0, 0, 0);
Torus.castShadow = true;
MetaBall.position.set(-4, 0, -2);
MetaBall.castShadow = true;
Pot.position.set(4, 0, -2);
Pot.castShadow = true;

Ground.rotation.x = -Math.PI / 2;
Ground.position.y = -2.2;
Ground.receiveShadow = true;
scene.add(Ground, MetaBall, Torus, Pot);

const Uniforms = {
  uColorSteps: { value: 3.3 },
};

// pane.addBinding(scene.fog, "color", { color: { type: "float" } });
// pane.addBinding(scene.fog, "density", { min:0, max:.2, step:0.0001 });

// Post Processing;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const ToonPass = GetToonPass(composer, pane);

const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  Pot.rotation.y += DT;

  Torus.rotation.x += DT;
  Torus.rotation.y += DT;

  // renderer.render(scene, camera);
  const SceneNormalTexture = CaptureNormals(scene, camera, renderer, innerWidth, innerHeight);
  ToonPass.update(DT,SceneNormalTexture)
  composer.render(DT);
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  composer.setSize(innerWidth, innerHeight);
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", resize);
