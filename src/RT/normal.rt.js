// Capturing scene normals;

import { Mesh } from "three";
import { PerspectiveCamera } from "three";
import { WebGLRenderTarget } from "three";
import { MeshNormalMaterial } from "three";
import { WebGLRenderer } from "three";
import { Scene } from "three";

const NormalRenderTarget = new WebGLRenderTarget(innerWidth, innerHeight);
const NormalMat = new MeshNormalMaterial();

export const CaptureNormals = (
  scene = new Scene(),
  camera = new PerspectiveCamera(),
  renderer = new WebGLRenderer(),
  width = 0,
  height = 0,
) => {
  NormalRenderTarget.setSize(width, height);
  const previousMaterial = scene.overrideMaterial;

  scene.overrideMaterial = NormalMat;

  renderer.setRenderTarget(NormalRenderTarget);

  renderer.render(scene, camera);

  renderer.setRenderTarget(null);

  scene.overrideMaterial = previousMaterial;

  return NormalRenderTarget.texture;
};
