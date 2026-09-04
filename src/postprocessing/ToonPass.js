import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pane } from "tweakpane";
import { Vector2 } from "three";
import { Uniform } from "three";
import { Color } from "three";

const ToonPass = {
  uniforms: {
    tDiffuse: new Uniform(null),
    tNormal: new Uniform(null),
    uNoise: new Uniform(null),
    uColorA: new Uniform(new Color("#ede8e8")) /* Environment Color */,
    uColorB: new Uniform(new Color("#1d1ac7")) /* Border Color */,
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
    uniform sampler2D tNormal;
    uniform sampler2D uNoise;
    uniform vec2 uResolution;
    uniform vec3 uColorA;
    uniform vec3 uColorB;

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

        // 3 by 3 pixels
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
        
        float SobelEdge = length(vec2(Gx, Gy));
        SobelEdge = clamp(SobelEdge,0.0,1.0);

        // float EdgeMask = smoothstep(.1,.3,edge);


        // 3 by 3 Normal
        vec3 currentNormal = texture(tNormal,uv + texel * vec2(0.0, 0.0)).rgb * 2.0 - 1.0;
        vec3 leftNormal = texture(tNormal, uv + texel * vec2(-1.0, 0.0)).rgb * 2.0 - 1.0;
        vec3 rightNormal = texture(tNormal, uv + texel * vec2(1.0, 0.0)).rgb * 2.0 - 1.0;
        vec3 topNormal = texture(tNormal, uv + texel * vec2(0.0, 1.0)).rgb * 2.0 - 1.0;
        vec3 bottomNormal = texture(tNormal, uv + texel * vec2(0.0, -1.0)).rgb * 2.0 - 1.0;

        float leftDiff   = length(currentNormal - leftNormal);
        float rightDiff  = length(currentNormal - rightNormal);
        float topDiff    = length(currentNormal - topNormal);
        float bottomDiff = length(currentNormal - bottomNormal);

        float NormalEdge = leftDiff + rightDiff + topDiff + bottomDiff;


       

        float Threshold = .3;

        float Edge = NormalEdge + SobelEdge;

        Edge = clamp(Edge,0.0,1.0);
        float SmoothEdge = smoothstep(.2,.8,Edge);

        float I = Luminance(DiffuseColor.rgb);

        vec3 FinalColor = mix(uColorA,uColorB,Edge);
        vec4 Noise = texture(uNoise,uv);

        FinalColor = mix(uColorA,uColorB,SmoothEdge);
        FinalColor = mix(uColorB * .8,FinalColor,step(1.0-I,.6));

        // Something Messed Up Here.
        FinalColor *= mix(Noise.r,1.0,step(1.0-I,.6));


        gl_FragColor = vec4(vec3(SmoothEdge),1.0);
        gl_FragColor = vec4(FinalColor,1.0);
        // gl_FragColor = Noise;
    }   
  `,
};

export const GetToonPass = (
  composer = new EffectComposer(),
  pane = new Pane(),
  noiseTexture = null
) => {
  // Place AFTER OutputPass so you're working in display (sRGB) space

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const toonPass = new ShaderPass(ToonPass);
  composer.addPass(toonPass);

  toonPass.uniforms["uNoise"].value = noiseTexture;

  const ToonFolder = pane.addFolder({ title: "Toon Setting", expanded: true });

  ToonFolder.addBinding(toonPass.uniforms.uColorA, "value", {
    color: { type: "float" },
    label: "Env Color",
  });
  ToonFolder.addBinding(toonPass.uniforms.uColorB, "value", {
    color: { type: "float" },
    label: "Border Color",
  });

  const Update = (DT = 0, SceneNormalTexture) => {
    toonPass.uniforms["tNormal"].value = SceneNormalTexture;
  };

  return {
    update: Update,
  };
};
