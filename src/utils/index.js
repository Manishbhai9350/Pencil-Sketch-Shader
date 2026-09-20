import { Mesh, PerspectiveCamera, Scene, Triangle, Vector3, WebGLRenderer } from "three";
import { degToRad } from "three/src/math/MathUtils.js";

export function GetSceneBounds(
  renderer = new WebGLRenderer(),
  camera = new PerspectiveCamera(),
) {
  const aspect = camera.aspect;
  const z = camera.position.z;
  const theta = degToRad(camera.fov) / 2;
  const height = Math.tan(theta) * z * 2;
  const width = height * aspect;
  return { width, height };
}

export function computeMeshNormal(mesh = new Mesh()) {
  const geometry = mesh.geometry;
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();

  // Get face 0's three vertices
  const a = new Vector3().fromBufferAttribute(pos, index.getX(0));
  const b = new Vector3().fromBufferAttribute(pos, index.getX(1));
  const c = new Vector3().fromBufferAttribute(pos, index.getX(2));

  // Built-in: THREE.Triangle.getNormal()
  const normal = new Vector3();
  new Triangle(a, b, c).getNormal(normal);
  // normal is already normalized

  console.log(normal); // { x, y, z }

  return normal;
}
