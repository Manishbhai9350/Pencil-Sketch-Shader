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
    uTime: new Uniform(0),
    uColorA: new Uniform(new Color("#f1f1f1")) /* Environment Color */,
    uColorB: new Uniform(new Color("#1e1ea6")) /* Border Color */,
    uResolution: new Uniform(new Vector2(innerWidth, innerHeight)),

    uShadowPower: new Uniform(.2),
    uShadowThreshold: new Uniform(.57),
    uPencilIntensity: new Uniform(.11),
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
    uniform float uTime;

    uniform float uShadowThreshold;
    uniform float uShadowPower;
    uniform float uPencilIntensity;

    varying vec2 vUv;

    vec3 luma = vec3(0.299,0.587,0.114);
    
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float Luminance(vec3 PixelColor){
      return dot(PixelColor,luma);
    } 

    const float bayerMatrix4x4[16] = float[](
        0.0,  8.0,  2.0, 10.0,
      12.0,  4.0, 14.0,  6.0,
        3.0, 11.0,  1.0,  9.0,
      15.0,  7.0, 13.0,  5.0
    );


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

        float Brightness = Luminance(DiffuseColor.rgb);

        // Sampling Noise Texture;
        vec4 Noise = texture(uNoise,uv);
        
        float ToonedBrightness = floor(Brightness * 5.0) / 5.0;

        vec3 EnvColor = mix(DiffuseColor.rgb,uColorA,0.0);
        vec3 FinalColor = mix(uColorA,uColorB,SmoothEdge);
        float ShadowIntensity = 1.0 - step(1.0-Brightness,uShadowThreshold);
        float ToonShadow = 1.0 - pow(ToonedBrightness,uShadowPower);
        float Shadow = ShadowIntensity * ToonShadow;
        

        // Dither Effect On Shadows
        int x = int(mod(gl_FragCoord.x, 4.0));
        int y = int(mod(gl_FragCoord.y, 4.0));
        float threshold = bayerMatrix4x4[y * 4 + x] / 16.0;

        float dithered = step(threshold, Brightness) * Shadow;

        FinalColor = mix(FinalColor,uColorB * .8,Shadow);
        // FinalColor = mix(FinalColor,uColorA * .6,dithered);

        float RNoise = random(vec2(uv + uTime * 100.0));
        // float Hatch = (sin((uv.x + uv.y) * 300.0) * .5 + .5) * RNoise;
        float HatchA = sin((uv.x + uv.y + uTime) * 1400.0) * RNoise;

        float HatchB = sin((uv.x - uv.y + uTime) * 1000.0) * RNoise;
        float PencilA = step(.4,HatchA);
        float PencilB = step(.4,HatchB);
        float Pencil = max(PencilA,PencilB);

        // FinalColor -= Pencil * ShadowIntensity * uPencilIntensity;

        // Noise On Light Part;

        float LightNoise = random(uv + uTime);
        FinalColor -= LightNoise * (1.0 - ShadowIntensity) * .1;

        // FinalColor = vec3(ToonShadow);
        // FinalColor = vec3(ShadowIntensity);

        // ShadowIntensity = min(.6,ShadowIntensity);
        // FinalColor = vec3(ShadowIntensity * ToonShadow);


        // FinalColor = mix(FinalColor,DiffuseColor.rgb,step(.333,uv.y));
        // FinalColor = mix(FinalColor,currentNormal.rgb,step(.666,uv.y));
        gl_FragColor = vec4(FinalColor,1.0);
        // gl_FragColor = Noise;
    }   
  `,
};

export const GetToonPass = (
  composer = new EffectComposer(),
  pane = new Pane(),
  noiseTexture = null,
) => {
  // Place AFTER OutputPass so you're working in display (sRGB) space

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const toonPass = new ShaderPass(ToonPass);
  composer.addPass(toonPass);

  toonPass.uniforms["uNoise"].value = noiseTexture;

  const ToonFolder = pane.addFolder({ title: "Toon Setting", expanded: false });

  ToonFolder.addBinding(toonPass.uniforms.uColorA, "value", {
    color: { type: "float" },
    label: "Env Color",
  });
  ToonFolder.addBinding(toonPass.uniforms.uColorB, "value", {
    color: { type: "float" },
    label: "Border Color",
  });


  ToonFolder.addBinding(toonPass.uniforms.uShadowPower, "value", {
    min:0,
    max:2,
    step:.001,
    label: "Shadow Power",
  });
  ToonFolder.addBinding(toonPass.uniforms.uShadowThreshold, "value", {
    min:0,
    max:1.1,
    step:.001,
    label: "Shadow Threshold",
  });
  ToonFolder.addBinding(toonPass.uniforms.uPencilIntensity, "value", {
    min:0,
    max:.5,
    step:.01,
    label: "Pencil Noise",
  });

  const Update = (DT = 0, SceneNormalTexture) => {
    toonPass.uniforms["tNormal"].value = SceneNormalTexture;
    toonPass.uniforms["uTime"].value += DT;
  };

  return {
    update: Update,
  };
};
