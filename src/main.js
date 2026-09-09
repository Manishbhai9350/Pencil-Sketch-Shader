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
import { Scene } from "three";
import { Vector3 } from "three";
import { ShaderPass } from "postprocessing";

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
  30,
  innerWidth / innerHeight,
  0.1,
  1000,
);
camera.position.z = 7;
camera.position.y = 4;

camera.position.set(2.3, 2, 3.4);
// camera.position.set(15, 5, .6);
camera.lookAt(new Vector3(4, 0, -2));

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

const MetaBallMaterial = GetToonMaterial({ color: "yellow" }, { InkMap });

const MetaBall = new Mesh(new IcosahedronGeometry(1, 10), MetaBallMaterial);

const Torus = new Mesh(
  new TorusKnotGeometry(1.3, 0.3, 100, 100),
  GetToonMaterial({ color: "limegreen" }, { InkMap }),
  // new MeshStandardMaterial({color:'red'})
);

Pot.visible = Ground.visible = Torus.visible = MetaBall.visible = false;

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

scene.add(new AmbientLight(0xffffff, 1));

const CenterBallTarget = new Mesh(
  new IcosahedronGeometry(0.1, 1),
  new MeshBasicMaterial({ color: "yellow" }),
);
CenterBallTarget.position.set(-1 / 2, 0, 0);
CenterBallTarget.visible = true;

scene.add(new AmbientLight(0xffffff, 0.3));
const D = new DirectionalLight(0xffffff, 6.5);
D.position.set(4, 1, 3);
D.target = CenterBallTarget;
D.castShadow = true;
const DD = new THREE.DirectionalLightHelper(D, 0.1, "red");
scene.add(D, DD);

Controls.target0 = CenterBallTarget;
scene.add(CenterBallTarget);

let LampLightPositionSet = false;
const LampLight = new THREE.SpotLight(0xffffff, 3, 3, 0.3, 0.7, 0.1);
LampLight.position.set(-1, 1, 1);
const LampLightHelp = new THREE.SpotLightHelper(LampLight, "purple");

LampLight.castShadow = true;


const LightningFolder = pane.addFolder({
  title:"Lightning",
  expanded:false
})

LightningFolder.addBinding(LampLight,'intensity',{
  min:0,
  max:10,
  step:.001,
  label:"Lamp Light"
}).on("change", () => LampLightHelp.update())
LightningFolder.addBinding(LampLight,'angle',{
  min:0,
  max:Math.PI,
  step:.001,
  label:"Lamp Angle"
}).on("change", () => LampLightHelp.update())
LightningFolder.addBinding(LampLight,'penumbra',{
  min:0,
  max:1,
  step:.001,
  label:"Lamp Penumbra"
}).on("change", () => LampLightHelp.update())

LightningFolder.addBinding(D,'intensity',{
  min:0,
  max:6,
  step:.001,
  label:"Directional Light"
})

scene.add(LampLight, LampLightHelp);


// ?? Scene Model
const StanMat = new MeshStandardMaterial({ color: "gray" });

let Model = null;
let ModelCamera = null;
let LampNormalStart = null;
let LampNormalStartPos = new Vector3();
let LampNormalEnd = null;
let LampNormalEndPos = new Vector3();
let LampNormal = null;
let DeskFocusSphere = null;
GLB.load("/models/scene.glb", (glb) => {
  Model = glb.scene;
  ModelCamera = glb.cameras[0];

  // Model.position.sub(new Vector3(4,1,0))

  LampNormalStart = Model.getObjectByName("lamp_normal_start");
  LampNormalStart.getWorldPosition(LampNormalStartPos);
  LampNormalEnd = Model.getObjectByName("lamp_normal_end");
  LampNormalEnd.getWorldPosition(LampNormalEndPos);

  LampNormal = LampNormalEnd.position
    .clone()
    .sub(LampNormalStart.position)
    .normalize();

  Model.traverse((Node) => {
    if (Node.isMesh) {
      if (Node.name == "desk_focus_sphere") {
        Node.material = new MeshBasicMaterial({ color: "purple" });

        DeskFocusSphere = Node;


        LampNormalEndPos = LampNormalEndPos.add(LampNormal.multiplyScalar(.05));
        LampLight.position.set(
          LampNormalEndPos.x,
          LampNormalEndPos.y,
          LampNormalEndPos.z,
        )

        LampLight.target = DeskFocusSphere;

        LampLightHelp.update();

        return;
      }
      Node.material = StanMat;
      Node.castShadow = true;
      Node.receiveShadow = true;
    }
  });

  scene.add(Model);
});


const Uniforms = {
  uColorSteps: { value: 3.3 },
};

// pane.addBinding(scene.fog, "color", { color: { type: "float" } });
// pane.addBinding(scene.fog, "density", { min:0, max:.2, step:0.0001 });

// Post Processing;

// composer.addPass(new RenderPass(scene, camera));
const ScratchNoiseTexture = TextureLoader.load("/textures/noise_scratch.png");

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ToonPass = GetToonPass(composer, pane, ScratchNoiseTexture);

const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  Pot.rotation.y += DT;

  Torus.rotation.x += DT;
  Torus.rotation.y += DT;

  const SceneNormalTexture = CaptureNormals(
    scene,
    camera,
    renderer,
    innerWidth,
    innerHeight,
  );

  ToonPass.update(DT, SceneNormalTexture);
  // renderer.render(scene, camera);
  composer.render(DT);
  

  if (!LampLightPositionSet && !!LampNormal) {
    console.log(LampNormal);

    const LampLightBall = new Mesh(
      new IcosahedronGeometry(2, 10),
      new MeshBasicMaterial({ color: "yellow" }),
    );
    scene.add(LampLightBall);
    LampLightBall.position.set(
      LampNormalStart.x,
      LampNormalStart.y,
      LampNormalStart.z,
    );
    LampLight.position.set(
      LampNormalStart.x,
      LampNormalStart.y,
      LampNormalStart.z,
    );
    LampLightPositionSet = true;
  }

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
