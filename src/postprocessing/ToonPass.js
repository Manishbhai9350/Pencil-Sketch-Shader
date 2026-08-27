import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pane } from "tweakpane";
import { Vector2 } from "three";
import { Uniform } from "three";

const ToonPass = {
  uniforms: {
    tDiffuse: new Uniform(null),
    uResolution: new Uniform(new Vector2(innerWidth, innerHeight)),
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;

    varying vec2 vUv;

    vec3 luma = vec3(0.299,0.587,0.114);
    
    float Luminance(vec3 PixelColor){
      return dot(PixelColor,luma);
    } 


    void main() {

        vec2 uv = vUv;

        vec4 DiffuseColor = texture(tDiffuse,uv);



        // Detecting Edges
        vec2 texel = 1.0 / uResolution;

        vec3 PixelRight = texture(tDiffuse,uv + texel * vec2(1.0,0.0) ).rgb;
        vec3 PixelBottomRight = texture(tDiffuse,uv + texel * vec2(1.0,-1.0) ).rgb;
        vec3 PixelBottom = texture(tDiffuse,uv + texel * vec2(.0,-1.0) ).rgb;
        vec3 PixelBottomLeft = texture(tDiffuse,uv + texel * vec2(-1.0,-1.0) ).rgb;
        vec3 PixelLeft = texture(tDiffuse,uv + texel * vec2(-1.0,0.0) ).rgb;
        vec3 PixelTopLeft = texture(tDiffuse,uv + texel * vec2(-1.0,1.0) ).rgb;
        vec3 PixelTop = texture(tDiffuse,uv + texel * vec2(0.0,1.0) ).rgb;
        vec3 PixelTopRight = texture(tDiffuse,uv + texel * vec2(1.0,1.0) ).rgb;
        
        float RightLum = Luminance(PixelRight);
        float BottomRightLum = Luminance(PixelBottomRight);
        float BottomLum = Luminance(PixelBottom);
        float BottomLeftLum = Luminance(PixelBottomLeft);
        float LeftLum = Luminance(PixelLeft);
        float TopLeftLum = Luminance(PixelTopLeft);
        float TopLum = Luminance(PixelTop);
        float TopRightLum = Luminance(PixelTopRight);

        float Gx =
        -TopLeftLum
        + TopRightLum
        - 2.0 * LeftLum
        + 2.0 * RightLum
        - BottomLeftLum
        + BottomRightLum;

        float Gy =
        -TopLeftLum
        - 2.0 * TopLum
        - TopRightLum
        + BottomLeftLum
        + 2.0 * BottomLum
        + BottomRightLum;

        float edge = length(vec2(Gx, Gy));
        edge = clamp(edge,0.0,1.0);

        float I = dot(DiffuseColor.rgb,vec3(0.2125, 0.7154, 0.0721));

        gl_FragColor = vec4(edge,edge,edge,1.0);
    }   
  `,
};

export const GetToonPass = (
  composer = new EffectComposer(),
  pane = new Pane(),
) => {
  // Place AFTER OutputPass so you're working in display (sRGB) space

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const toonPass = new ShaderPass(ToonPass);
  composer.addPass(toonPass);

  const ToonFolder = pane.addFolder({ title: "Toon Setting", expanded: false });

  const Update = (DT = 0) => {};

  return {
    update: Update,
  };
};
