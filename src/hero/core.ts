import {
    HalfFloatType,
    NeutralToneMapping,
    PCFShadowMap,
    ShaderMaterial,
    Vector2,
    WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { SceneId } from './bus.ts';
import type { Layer } from './kit.ts';

export interface Quality {
    bloom: boolean;
    shadows: boolean;
}

export interface Core {
    resize(width: number, height: number, pixelRatio: number): void;
    quality(next: Quality): void;
    /** Height of the drawing buffer in pixels. */
    pixels(): number;
    /** Fetches a page's scene and builds it. Its programs are compiled by `warm`, before it is ever drawn. */
    load(id: SceneId): Promise<Layer>;
    warm(layer: Layer): Promise<void>;
    /** Draws `front`; while `back` is given, the two are blended, `mix` of the way from back to front. */
    draw(front: Layer, back: Layer | null, mix: number): void;
}

const LOADERS: Record<SceneId, () => Promise<{ create(): Layer }>> = {
    home: () => import('./scenes/chain.ts'),
    left: () => import('./scenes/left.ts'),
    power: () => import('./scenes/power.ts'),
    convert: () => import('./scenes/convert.ts'),
    dca: () => import('./scenes/dca.ts'),
    address: () => import('./scenes/address.ts'),
};

const BLEND_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BLEND_FRAGMENT = /* glsl */ `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uMix;
varying vec2 vUv;

void main() {
    gl_FragColor = mix(texture2D(uFrom, vUv), texture2D(uTo, vUv), uMix);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

function pause(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The composer's first pass: whatever `paint` draws lands in the buffer the bloom reads. */
class PaintPass extends Pass {
    private readonly paint: (target: WebGLRenderTarget) => void;

    constructor(paint: (target: WebGLRenderTarget) => void) {
        super();
        this.paint = paint;
        this.needsSwap = false;
    }

    override render(_renderer: WebGLRenderer, _write: WebGLRenderTarget, read: WebGLRenderTarget): void {
        this.paint(read);
    }
}

/**
 * The one renderer behind every page. Scenes come and go with the route; the canvas, the context and the bloom
 * stay for the whole visit.
 */
export function createCore(canvas: HTMLCanvasElement, context: WebGL2RenderingContext): Core {
    const renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;

    const blend = new ShaderMaterial({
        vertexShader: BLEND_VERTEX,
        fragmentShader: BLEND_FRAGMENT,
        uniforms: { uFrom: { value: null }, uTo: { value: null }, uMix: { value: 0 } },
        depthTest: false,
        depthWrite: false,
    });
    const quad = new FullScreenQuad(blend);
    let fading: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
    let bloom = true;
    let shadows = true;
    let front: Layer | null = null;
    let back: Layer | null = null;
    let mix = 1;
    const buffer = new Vector2();

    function targets(): [WebGLRenderTarget, WebGLRenderTarget] {
        renderer.getDrawingBufferSize(buffer);
        if (fading && fading[0].width === buffer.x && fading[0].height === buffer.y) return fading;
        release();
        const make = () => new WebGLRenderTarget(buffer.x, buffer.y, { type: HalfFloatType, samples: bloom ? 4 : 0 });
        fading = [make(), make()];
        return fading;
    }

    function release(): void {
        for (const target of fading ?? []) target.dispose();
        fading = null;
    }

    function paint(target: WebGLRenderTarget | null): void {
        if (!front) return;
        if (!back) {
            renderer.setRenderTarget(target);
            renderer.render(front.scene, front.camera);
            return;
        }
        const [from, to] = targets();
        renderer.setRenderTarget(from);
        renderer.render(back.scene, back.camera);
        renderer.setRenderTarget(to);
        renderer.render(front.scene, front.camera);
        const { uFrom, uTo, uMix } = blend.uniforms;
        if (uFrom) uFrom.value = from.texture;
        if (uTo) uTo.value = to.texture;
        if (uMix) uMix.value = mix;
        renderer.setRenderTarget(target);
        quad.render(renderer);
    }

    const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
    composer.addPass(new PaintPass(paint));
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.34, 0.55, 1));
    composer.addPass(new OutputPass());

    return {
        resize(width, height, pixelRatio) {
            const wide = Math.max(1, width);
            const tall = Math.max(1, height);
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(wide, tall, false);
            composer.setPixelRatio(pixelRatio);
            composer.setSize(wide, tall);
        },
        quality(next) {
            if (next.bloom !== bloom) release();
            bloom = next.bloom;
            shadows = next.shadows;
        },
        pixels: () => renderer.domElement.height,
        async load(id) {
            const { create } = await LOADERS[id]();
            return create();
        },
        async warm(layer) {
            layer.shadows?.(shadows);
            layer.prepare?.();
            // One object or one texture per task: built in one go, a phone's main thread is held for half a second.
            for (const child of layer.scene.children) {
                await pause();
                await renderer.compileAsync(child, layer.camera, layer.scene);
            }
            for (const texture of layer.textures?.() ?? []) {
                await pause();
                renderer.initTexture(texture);
            }
        },
        draw(nextFront, nextBack, nextMix) {
            front = nextFront;
            back = nextBack;
            mix = nextMix;
            front.shadows?.(shadows);
            back?.shadows?.(shadows);
            if (!back) release();
            if (bloom) composer.render();
            else paint(null);
        },
    };
}
