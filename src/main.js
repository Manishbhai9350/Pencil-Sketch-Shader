import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import fragmentShader from "./shaders/fragment.glsl";
import vertexShader from "./shaders/vertex.glsl";
import { Clock } from "three";
import { GetSceneBounds } from "./utils";
import { OrbitControls, TeapotGeometry } from "three/examples/jsm/Addons.js";
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
import { CylinderGeometry } from "three";

const { PI } = Math;

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

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  1,
  1000,
);
camera.position.z = 5;

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

scene.background = new Color("#3a3a3a");
scene.fog = new FogExp2("#3a3a3a", 0.1);

const InkMap = TextureLoader.load("/textures/ink.jpg");

const D1 = new DirectionalLight(0xffffff, 2);

D1.castShadow = true;
D1.position.set(1, 1, 1);

scene.add(D1);

const PotMaterial = GetToonMaterial({},{ InkMap });

const Pot = new THREE.Mesh(new TeapotGeometry(1), PotMaterial);

Pot.castShadow = true;

const Ground = new Mesh(
  new PlaneGeometry(100, 100),
  GetToonMaterial({
    color:'#9b9090',
    baseMaterial: MeshBasicMaterial
  },{ InkMap, ink:false })
);

const MetaBallMaterial = GetToonMaterial({ color:'yellow' },{ InkMap });

const MetaBall = new Mesh(
  new IcosahedronGeometry(1,10),
  // MetaBallMaterial
  new MeshToonMaterial({ color:'red' })
)

const Cylinder = new Mesh(
  new CylinderGeometry(1,1,2,30,20),
  GetToonMaterial({ color:"limegreen" },{InkMap})
)

Cylinder.position.x = 2;

MetaBall.position.x = -3
MetaBall.position.z = 2

Ground.rotation.x = -Math.PI / 2;
Ground.position.y = -1;
// Ground.receiveShadow = true;
scene.add(Ground,MetaBall,Cylinder);

// Pot.material.onBeforeCompile = (shader) => {
//   // shader.vertexShader = vertexShader;
//   // shader.fragmentShader = fragmentShader;
// };

scene.add(Pot);

console.log(Pot);

const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  Pot.rotation.y += DT;

  renderer.render(scene, camera);
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", resize);
