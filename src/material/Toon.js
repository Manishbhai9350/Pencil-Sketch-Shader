import CSM from "three-custom-shader-material/vanilla";
import { DoubleSide, Uniform } from "three";
import { MeshStandardMaterial } from "three";
import { Color } from "three";
import { Vector3 } from "three";

const BasicToonMaterial = (config = {}, { InkMap, ink = false }) => {
  return new CSM({
    baseMaterial: MeshStandardMaterial,
    side: DoubleSide,
    color: "#2d51f3",
    uniforms: {
      uInkMap: new Uniform(InkMap),
      uInk: new Uniform(ink ? 1 : 0),
      uColorSteps: new Uniform(3.3),
    },
    vertexShader: /* glsl */ `
    varying vec3 csm_v_normal;
    varying vec3 csm_v_position;
    varying vec2 vUv;

    void main(){


      csm_v_normal = normalize((modelMatrix * vec4(csm_Normal,.0)).xyz);
      // csm_v_normal = normalize(csm_Normal);

      vUv = uv;
      csm_v_position = position.xyz;

    }
  
  `,
    fragmentShader: /* glsl */ `
  varying vec3 csm_v_normal;
  varying vec3 csm_v_position;
  varying vec2 vUv;

  uniform float uInk;
  uniform float uColorSteps;
  uniform sampler2D uInkMap;

  #define Threshold .5

  float noise(vec2 p) {
    return fract(
        sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453
    );
  }

  float StepNode (float x) {
    float v = floor(x * uColorSteps) / uColorSteps;
    float f = v * (1.0 - .01) + noise(vec2(x,x) * 100.0) * .01;

    return v;
  }

  float CalculateLightIntensity(vec3 light, vec3 normal, float intensity){
    return max(.0,dot(normal,light) * intensity) * Threshold + (1.0 - Threshold);
  }

  void main(){
    vec2 uv = vUv;
    vec3 LightDir = vec3(1.0,1.0,1.0);


    vec3 LightToFrag = csm_v_position - LightDir;
    LightToFrag = abs(normalize(LightToFrag));

    LightToFrag = fract(LightToFrag * 1.0);

  
    vec3 L = normalize(LightDir);
    vec3 N = normalize(csm_v_normal);

  
    float I = CalculateLightIntensity(L,N,1.5);

    float n = noise(vUv * .01);

    float sketchIntensity = I;

    float SteppedI = StepNode(sketchIntensity);

    vec3 color = csm_DiffuseColor.rgb;

    // if(SteppedI * 2.5 >= 2.4) {
    //     color *= 1.4;
    // }

    vec3 FinalColor = color * SteppedI;
  
    
    vec4 Ink = texture(uInkMap,LightToFrag.xy) * uInk;
    
    vec3 InkIntensity = vec3(1.0) - Ink.xyz;
    
    
    float IIF = .03;
    FinalColor *= ((1.0 - IIF) + InkIntensity * IIF);
    
    
    csm_FragColor = vec4(vec3(FinalColor),1.0);
    // csm_FragColor = vec4(uv,0.0,1.0);
    // csm_FragColor = vec4(LightToFrag.xy,0.0,1.0);
    // csm_FragColor = vec4(vec3(1.0) - Ink.xyz,1.0);

  }

  
  `,
    ...config,
  });
};

const GetInjectedToonMaterial = (config) => {
  const material = new MeshStandardMaterial({
    color: config?.color || "white",
    side: DoubleSide
  });

  let anime = false;

  if (anime) {
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        /* glsl */ `
  
      float threshold = .1;
      float steps = 10.0;
      float intensity = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
      intensity = intensity * (1.0 - threshold) + threshold;
      intensity = floor(intensity * steps) / steps;

      vec3 toonColor = diffuseColor.rgb * intensity;
      gl_FragColor = vec4(toonColor, diffuseColor.a);
      
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    `,
      );
    };
  }

  return material;
};

export const GetToonMaterial = (config = {}, uniforms = {}) => {
  // return BasicToonMaterial(config, uniforms);

  return GetInjectedToonMaterial(config);
};
