import { HalfFloatType, NeutralToneMapping, PCFShadowMap, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
    /** Fetches the world and builds it. Its programs are compiled by `warm`, before it is ever drawn. */
    load(): Promise<Layer>;
    warm(layer: Layer): Promise<void>;
    draw(layer: Layer): void;
}

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
 * The one renderer behind every page: one canvas, one context, one world and its bloom for the whole visit.
 */
export function createCore(canvas: HTMLCanvasElement, context: WebGL2RenderingContext): Core {
    const renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;

    let bloom = true;
    let shadows = true;
    let shown: Layer | null = null;

    function paint(target: WebGLRenderTarget | null): void {
        if (!shown) return;
        renderer.setRenderTarget(target);
        renderer.render(shown.scene, shown.camera);
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
            bloom = next.bloom;
            shadows = next.shadows;
        },
        pixels: () => renderer.domElement.height,
        async load() {
            const { create } = await import('./scenes/chain.ts');
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
        draw(layer) {
            shown = layer;
            layer.shadows?.(shadows);
            if (bloom) composer.render();
            else paint(null);
        },
    };
}
