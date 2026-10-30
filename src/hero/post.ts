import {
    AdditiveBlending,
    type Camera,
    Color,
    HalfFloatType,
    type Scene,
    ShaderMaterial,
    UniformsUtils,
    Vector2,
    Vector3,
    type WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import type { Rgb } from './aces.ts';

export const GLOW_LAYER = 1;

const MSAA_SAMPLES = 4;
const BLOOM = { strength: 1.15, radius: 0.55, threshold: 0 };

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// The vignette fades toward the page background rather than black, so the canvas edge meets the page.
const FINISH = {
    uniforms: {
        tDiffuse: { value: null },
        uBackground: { value: new Vector3() },
        uAspect: { value: 1 },
        uSeed: { value: 0 },
        uGrain: { value: 0.028 },
    },
    vertexShader: VERTEX,
    fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uBackground;
uniform float uAspect, uSeed, uGrain;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 c = vUv - vec2(0.5, 0.56);
    c.x *= uAspect;
    float d = length(c) / max(1.0, uAspect * 0.62);
    vec2 fringe = (vUv - 0.5) * 0.0018 * smoothstep(0.3, 0.9, d);
    vec3 col = vec3(
        texture2D(tDiffuse, vUv + fringe).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - fringe).b
    );
    col = mix(uBackground, col, smoothstep(0.98, 0.32, d));
    col += (hash(vUv * vec2(1931.0, 1087.0) + uSeed) - 0.5) * uGrain;
    gl_FragColor = vec4(col, 1.0);
}`,
};

class GlowPass extends Pass {
    private readonly bloom = new UnrealBloomPass(new Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    private readonly source = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    private readonly blend = new FullScreenQuad(
        new ShaderMaterial({
            uniforms: UniformsUtils.clone(CopyShader.uniforms),
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader,
            blending: AdditiveBlending,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        }),
    );
    private readonly clearColor = new Color();

    constructor(
        private readonly scene: Scene,
        private readonly camera: Camera,
    ) {
        super();
        this.needsSwap = false;
    }

    override setSize(width: number, height: number): void {
        this.source.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
        this.bloom.setSize(width / 2, height / 2);
    }

    override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
        const { background, fog } = this.scene;
        const mask = this.camera.layers.mask;
        const autoClear = renderer.autoClear;
        const alpha = renderer.getClearAlpha();
        renderer.getClearColor(this.clearColor);
        this.scene.background = null;
        this.scene.fog = null;
        this.camera.layers.set(GLOW_LAYER);
        renderer.autoClear = false;
        renderer.setRenderTarget(this.source);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        this.camera.layers.mask = mask;
        this.scene.background = background;
        this.scene.fog = fog;
        renderer.setClearColor(this.clearColor, alpha);
        this.bloom.render(renderer, writeBuffer, this.source, 0, false);
        const uniform = (this.blend.material as ShaderMaterial).uniforms.tDiffuse;
        if (uniform) uniform.value = this.bloom.renderTargetsHorizontal[0]?.texture ?? null;
        renderer.setRenderTarget(readBuffer);
        this.blend.render(renderer);
        renderer.autoClear = autoClear;
    }

    override dispose(): void {
        this.bloom.dispose();
        this.source.dispose();
        this.blend.material.dispose();
        this.blend.dispose();
    }
}

export interface Post {
    render(): void;
    setSize(width: number, height: number, pixelRatio: number): void;
    compileTarget(): WebGLRenderTarget;
    dispose(): void;
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera, background: Rgb): Post {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: MSAA_SAMPLES });
    const composer = new EffectComposer(renderer, target);
    const finish = new ShaderPass(FINISH);
    (finish.uniforms.uBackground as { value: Vector3 }).value.set(...background);
    const passes = [new RenderPass(scene, camera), new GlowPass(scene, camera), new OutputPass(), finish];
    for (const pass of passes) composer.addPass(pass);
    let frame = 0;

    return {
        render() {
            frame = (frame + 1) % 64;
            (finish.uniforms.uSeed as { value: number }).value = frame * 0.37;
            composer.render();
        },
        setSize(width, height, pixelRatio) {
            composer.setPixelRatio(pixelRatio);
            composer.setSize(width, height);
            (finish.uniforms.uAspect as { value: number }).value = width / height;
        },
        compileTarget: () => composer.readBuffer,
        dispose() {
            for (const pass of passes) pass.dispose();
            composer.dispose();
        },
    };
}
