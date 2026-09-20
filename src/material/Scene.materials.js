import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Uniform,
} from "three";

const monitor_bar_light = new MeshBasicMaterial({
  color: "purple",
  allowOverride: false,
});
const keyboard_key = new MeshBasicMaterial({
  color: "purple",
  allowOverride: false,
});
const monitor_bar_light_light = new MeshStandardMaterial({
  emissive: "white",
  emissiveIntensity: 20,
  allowOverride: false,
});

const apple_logo_plane = new ShaderMaterial({
  transparent: true,
  // allowOverride:false,
  uniforms: {
    uMap: new Uniform(null),
  },
  vertexShader: /* glsl */ `  

    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
    
    `,
  fragmentShader: /* glsl */ `  
    varying vec2 vUv;
    uniform sampler2D uMap;

    #define PI 3.1415926

    vec2 rotate(vec2 v, float theta) {
      float s = sin(theta);
      float c = cos(theta);
      return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
    }

    void main(){
      vec2 UV = vUv;
      UV -= .5;
      UV = rotate(UV,PI / 2.0);
      UV += .5;
      vec4 map = texture(uMap,UV);
      // gl_FragColor =  vec4(vec2(UV),0.0,1.0);
      float opacity = 1.0 - step(map.r,.05);

      gl_FragColor = vec4(vec3(0.0),opacity);
    }
    
    `,
});

export const Materials = {
  monitor_bar_light,
  monitor_bar_light_2: monitor_bar_light,
  monitor_bar_light_light,
  keyboard_key,
  apple_logo_plane,
};

export const ExcludeNormalMaterials = {
  monitor_bar_light,
  monitor_bar_light_light,
  bloc: monitor_bar_light,
};
