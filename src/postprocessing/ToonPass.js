import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pane } from "tweakpane";

const ToonPass = {
  uniforms: {
    uAspect: { value: innerWidth/innerHeight },
    uTime: { value:0 },
    tDiffuse: { value: null },
    uSteps: { value: 7.0 },
    uContrast: { value: 1.1 },
    uBrightness: { value: 1.4 },
    uSaturation: { value: 0.7 },
    noiseOpacity: { value:.26 },
    noiseSize: { value: 100 },
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
    uniform float uTime;
    uniform float uSteps;
    uniform float uAspect;
    uniform float uContrast;   // e.g. 1.4
    uniform float uBrightness; // e.g. 1.15
    uniform float uSaturation; // e.g. 1.2
    uniform float noiseOpacity;
    uniform float noiseSize;

    varying vec2 vUv;

    float Random(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {

        vec2 uv = vUv;

        // uv = abs(vec2(sin(uv.x * 3.1415926 * 2.0),sin(uv.y * 3.1415926 * 2.0)));

        vec4 color = texture2D(tDiffuse, uv);

        // Luminance
        float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

        // Quantize (few steps = cel look)
        float q = floor(lum * uSteps) / uSteps;

        // Preserve hue: scale by ratio, not by absolute luminance
        float ratio = (lum > 0.001) ? q / lum : 0.0;
        vec3 stepped = color.rgb * ratio;

        // Contrast: pull mids toward black/white
        stepped = (stepped - 0.5) * uContrast + 0.5;

        // Brightness lift
        stepped *= uBrightness;

        // Saturation boost (push away from gray)
        float gray = dot(stepped, vec3(0.2126, 0.7152, 0.0722));
        stepped = mix(vec3(gray), stepped, uSaturation);
        vec3 FinalColor = clamp(stepped, 0.0, 1.0);

        float R = Random(floor(uv * noiseSize * 10.) / (noiseSize * 10.0) + mod(uTime * .01,1.0));

        FinalColor *= (1.0 - noiseOpacity) + R * noiseOpacity;

        vec2 VignetteUV = uv * vec2(1.0,uAspect);
        float Vignette = 1.0 - length(2.0 * (uv - vec2(.5))) / pow(2.0,.5);

        Vignette = smoothstep(0.0,.8,Vignette);

        FinalColor *= vec3(Vignette);

        // Clamp
        gl_FragColor = vec4(FinalColor, color.a);
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

  const ToonFolder = pane.addFolder({ title:"Toon Setting", expanded:false })

  ToonFolder.addBinding(toonPass.uniforms.uContrast, "value", {
    min: 0,
    max: 2,
    step: 0.01,
    label: "Contrast",
  });
  ToonFolder.addBinding(toonPass.uniforms.uBrightness, "value", {
    min: 0,
    max: 2,
    step: 0.01,
    label: "Brightness",
  });
  ToonFolder.addBinding(toonPass.uniforms.noiseOpacity, "value", {
    min: 0,
    max: 1,
    step: 0.01,
    label: "Noise Opacity",
  });
  ToonFolder.addBinding(toonPass.uniforms.noiseSize, "value", {
    min: 0.1,
    max: 200,
    step: 0.01,
    label: "Noise Size",
  });

  const Update = (DT = 0) => {
    toonPass.uniforms.uTime.value += DT;
  }

  return {
    update:Update
  }
};
