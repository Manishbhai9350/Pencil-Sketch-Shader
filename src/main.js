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
import CSM from "three-custom-shader-material/vanilla";

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

const D1 = new DirectionalLight(0xffffff, 2);

D1.castShadow = true;
D1.position.set(1, 1, 1);

scene.add(D1);

const PotMaterial = new CSM({
  baseMaterial: MeshStandardMaterial,
  side: THREE.DoubleSide,
  color: "#2d51f3",
  vertexShader: /* glsl */ `
    varying vec3 csm_v_normal;
    varying vec2 vUv;

    void main(){


      csm_v_normal = normalize((modelMatrix * vec4(csm_Normal,.0)).xyz);
      // csm_v_normal = normalize(csm_Normal);

      vUv = uv;

    }
  
  `,
  fragmentShader: /* glsl */ `
  varying vec3 csm_v_normal;
  varying vec2 vUv;

  #define Threshold .7

  float noise(vec2 p) {
    return fract(
        sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453
    );
  }

  float StepNode (float x) {
    float v = floor(x * 4.0) / 4.0;
    float f = v * .9 + noise(vec2(x,x) * 100.0) * .1;

    return v;
  }

  float CalculateLightIntensity(vec3 light, vec3 normal, float intensity){
    return max(.0,dot(normal,light) * intensity) * Threshold + (1.0 - Threshold);
  }

  void main(){
    vec3 LightDir = vec3(1.0,1.0,1.0);
  
    vec3 L = normalize(LightDir);
    vec3 N = normalize(csm_v_normal);

  
    float I = CalculateLightIntensity(L,N,1.5);

    float n = noise(vUv * .01);

    float sketchIntensity = I + (n - 0.5) * 0.05;

    float SteppedI = StepNode(sketchIntensity);

    vec3 FinalColor = csm_DiffuseColor.rgb * SteppedI;
  
    csm_FragColor = vec4(vec3(FinalColor),1.0);

  }

  
  `,
});

const Pot = new THREE.Mesh(new TeapotGeometry(1), PotMaterial);

Pot.castShadow = true;

const Ground = new Mesh(
  new PlaneGeometry(100, 100),
  new MeshStandardMaterial({
    color: "#ffffff",
  }),
);

Ground.rotation.x = -Math.PI / 2;
Ground.position.y = -1;
// Ground.receiveShadow = true;
scene.add(Ground);

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
