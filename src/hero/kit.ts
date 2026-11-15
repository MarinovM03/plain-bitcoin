import {
    BufferAttribute,
    BufferGeometry,
    Color,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    PerspectiveCamera,
    PlaneGeometry,
    Points,
    type Scene,
    ShaderMaterial,
    type Texture,
} from 'three';
import { type BackdropData, type Mark, TONES } from '../backdrop/types.ts';
import { FACE_CELLS, HASH_BITS, hashBits } from '../chain/hash.ts';
import type { Camera } from '../chain/view.ts';
import { TOKENS } from '../styles/tokens.ts';
import type { Actor, ActorPose } from './actors.ts';

export interface ChainDraw {
    camera: Camera;
    /** Each tablet on stage with where it is right now. */
    slabs: readonly { actor: Actor; pose: ActorPose }[];
    /** 0 hides the forming block; 1 shows it fully. */
    ghost: number;
    /** Share of the motes gathered on the forming block, 0 to 1. */
    fill: number;
}

/** What a scene is told each frame. It is never asked anything back. */
export interface Tick {
    seconds: number;
    width: number;
    height: number;
    /** Height of the drawing buffer in pixels. */
    pixels: number;
    /** Nothing may be mid-move: reduced motion, or a single frame drawn while the loop is parked. */
    still: boolean;
    /** The newest block's hash: the squares in the air are its 256 bits. */
    hash: string | null;
    chain: ChainDraw | null;
    data: BackdropData | null;
}

export interface Layer {
    readonly scene: Scene;
    readonly camera: PerspectiveCamera;
    /** Shows everything once, so every program is built before the first frame. */
    prepare?(): void;
    /** Textures to hand to the GPU one at a time before the first frame, so no frame has to send them all. */
    textures?(): readonly Texture[];
    shadows?(on: boolean): void;
    update(tick: Tick): void;
    dispose(): void;
}

/** Linear-light Bitcoin orange, pushed past white so only it reaches the bloom. */
export const GLOW = new Color(TOKENS.btc).multiplyScalar(2.4);

const TONE_COLOURS: Record<(typeof TONES)[number], Color> = {
    btc: new Color(TOKENS.btc).multiplyScalar(1.7),
    warm: new Color(TOKENS.inkWarm).multiplyScalar(0.85),
    cool: new Color(TOKENS.inkCool),
    good: new Color(TOKENS.good).multiplyScalar(1.2),
    dim: new Color(TOKENS.inkDim).multiplyScalar(0.7),
};

/** Every tool scene is seen from the same place: straight on, ten units back. */
export const VIEW = { fov: 32, distance: 10, half: Math.tan((16 * Math.PI) / 180) * 10 } as const;

// A fixed, seeded scatter: dust is texture, so every visit and every still frame shows the same cloud.
export function seeds(count: number, salt: number): Float32Array {
    const out = new Float32Array(count);
    let state = salt;
    for (let index = 0; index < count; index += 1) {
        state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
        state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
        state ^= state >>> 15;
        out[index] = (state >>> 0) / 4294967296;
    }
    return out;
}

function set(material: ShaderMaterial, name: string, value: unknown): void {
    const uniform = material.uniforms[name];
    if (uniform) uniform.value = value;
}

const DUST_LAYERS = 3;

const DUST_VERTEX = /* glsl */ `
attribute vec3 aCell;
attribute vec3 aRand;
attribute float aBit;
attribute float aPrev;
uniform float uTime;
uniform float uFlip;
uniform float uPixels;
uniform float uLevel;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uAxis;
uniform vec3 uAcross;
uniform vec3 uCentre;
varying float vOn;
varying float vFlash;
varying float vAlpha;

void main() {
    float pace = 0.7 + 0.6 * aRand.x;
    float rise = mod(aCell.y * 0.5 + aRand.y * 0.5 + uTime * 0.035 * pace, 8.0);
    float run = (aCell.x - 7.5) * 1.5 + (aRand.z - 0.5) * 0.9;
    float depth = (aCell.z < 0.5 ? -7.5 : aCell.z < 1.5 ? -4.6 : -2.0) + (aRand.x - 0.5) * 1.6;
    vec3 world = uCentre + uAxis * run + uAcross * depth + vec3(0.0, 0.3 + rise, 0.0);
    world.x += sin(uTime * 0.21 + aCell.x * 0.9 + aCell.y) * 0.06;
    vec4 seen = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * seen;

    float since = uFlip - aCell.y * 0.07 - aCell.x * 0.014;
    vOn = since >= 0.0 ? aBit : aPrev;
    vFlash = since >= 0.0 && since < 0.42 ? 1.0 - since / 0.42 : 0.0;
    gl_PointSize = max(2.0, uPixels * (0.05 + 0.04 * aRand.z) / gl_Position.w);
    float away = -seen.z;
    float fog = 1.0 - smoothstep(uFogNear, uFogFar + 6.0, away);
    float wrap = smoothstep(0.0, 0.8, rise) * smoothstep(8.0, 6.8, rise);
    vAlpha = fog * wrap * smoothstep(2.0, 5.0, away) * uLevel;
}
`;

const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uSet;
uniform vec3 uUnset;
varying float vOn;
varying float vFlash;
varying float vAlpha;

void main() {
    vec2 q = abs(gl_PointCoord - 0.5);
    float outline = smoothstep(0.3, 0.36, max(q.x, q.y));
    float alpha = vOn > 0.5 ? 0.62 + 0.38 * vFlash : (0.1 + 0.4 * vFlash) * outline;
    vec3 colour = vOn > 0.5 ? uSet * (1.0 + vFlash) : uUnset;
    gl_FragColor = vec4(colour, alpha * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export interface Dust {
    readonly points: Points;
    update(tick: Tick, pixels: number, level: number, fog: { near: number; far: number }): void;
    dispose(): void;
}

/**
 * The squares in the air behind every scene: the newest block's hash, one square per bit at three depths, set bits
 * orange. They flip in a wave when a new block's hash arrives.
 */
export function createDust(place: {
    centre: readonly number[];
    axis: readonly number[];
    across: readonly number[];
}): Dust {
    const count = HASH_BITS * DUST_LAYERS;
    const cells = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        const bit = index % HASH_BITS;
        cells.set([bit % FACE_CELLS, Math.floor(bit / FACE_CELLS), Math.floor(index / HASH_BITS)], index * 3);
    }
    const bits = new BufferAttribute(new Float32Array(count), 1);
    const previous = new BufferAttribute(new Float32Array(count), 1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aCell', new BufferAttribute(cells, 3));
    geometry.setAttribute('aRand', new BufferAttribute(seeds(count * 3, 0x51ed270b), 3));
    geometry.setAttribute('aBit', bits);
    geometry.setAttribute('aPrev', previous);
    const material = new ShaderMaterial({
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        uniforms: {
            uTime: { value: 0 },
            uFlip: { value: 1000 },
            uPixels: { value: 1 },
            uLevel: { value: 1 },
            uFogNear: { value: 5 },
            uFogFar: { value: 20 },
            uAxis: { value: [...place.axis] },
            uAcross: { value: [...place.across] },
            uCentre: { value: [...place.centre] },
            uSet: { value: GLOW },
            uUnset: { value: new Color(TOKENS.inkWarm) },
        },
        transparent: true,
        depthWrite: false,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 1;
    let shown: string | null = null;
    let flippedAt = Number.NEGATIVE_INFINITY;

    function show(hash: string | null, seconds: number): void {
        if (hash === shown) return;
        const first = shown === null;
        shown = hash;
        const next = hashBits(hash);
        const spread = Array.from({ length: count }, (_, index) => next[index % HASH_BITS] ?? 0);
        previous.array.set(first ? spread : bits.array);
        bits.array.set(spread);
        bits.needsUpdate = true;
        previous.needsUpdate = true;
        flippedAt = first ? Number.NEGATIVE_INFINITY : seconds;
    }

    return {
        points,
        update(tick, pixels, level, fog) {
            show(tick.hash, tick.seconds);
            set(material, 'uTime', tick.seconds);
            set(material, 'uFlip', tick.still ? 1000 : tick.seconds - flippedAt);
            set(material, 'uPixels', pixels);
            set(material, 'uLevel', level);
            set(material, 'uFogNear', fog.near);
            set(material, 'uFogFar', fog.far);
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}

const MARK_VERTEX = (motion: string) => /* glsl */ `
attribute vec4 aPlan;
attribute vec4 aNow;
attribute vec2 aWas;
uniform float uTime;
uniform float uSince;
uniform float uStagger;
uniform float uAspect;
uniform float uUnit;
uniform vec4 uA;
uniform vec3 uTones[${TONES.length}];
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vShape;

void main() {
    float order = aNow.w;
    float seed = fract(sin(float(gl_InstanceID) * 12.9898 + 4.1414) * 43758.5453);
    float ease = smoothstep(0.0, 1.0, clamp((uSince - order * uStagger) / 0.45, 0.0, 1.0));
    float level = mix(aWas.x, aNow.x, ease);
    vec3 colour = mix(uTones[int(aWas.y + 0.5)], uTones[int(aNow.y + 0.5)], ease);
    float shape = aNow.z;
    vec3 at = vec3(aPlan.xy * uUnit, 0.0);
    vec2 size = aPlan.zw * uUnit;
    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float alpha = level;
    float glow = 1.0;
    ${motion}
    vec3 world = at + right * (position.x * size.x) + up * (position.y * size.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    vUv = position.xy;
    vTint = vec4(colour * glow, alpha);
    vShape = vec2(mod(shape, 2.0), step(1.5, shape) * step(shape, 3.5));
}
`;

const MARK_FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vShape;

void main() {
    vec2 q = abs(vUv);
    float reach = mix(max(q.x, q.y), length(vUv), vShape.x) * 2.0;
    float soft = fwidth(reach) * 1.2 + 0.001;
    float body = 1.0 - smoothstep(1.0 - soft, 1.0, reach);
    float ring = smoothstep(0.6 - soft, 0.6, reach);
    float alpha = body * mix(1.0, ring, vShape.y) * vTint.a;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vTint.rgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export interface Marks {
    readonly mesh: Mesh;
    /** Shows a new plan; every mark eases from what it was, in the order it stands in the plan. */
    show(plan: readonly Mark[], seconds: number): void;
    update(tick: Tick, aspect: number, extra: readonly [number, number, number, number]): void;
    dispose(): void;
}

/**
 * A tool's picture: flat marks, one small quad each, drawn in a single call. `motion` is the scene's own GLSL: it
 * may move `at`, `size`, `right`, `up`, `alpha`, `glow`, `colour` and `shape` for each mark.
 */
export function createMarks(capacity: number, motion: string, stagger: number): Marks {
    const quad = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    const plans = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const now = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const was = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    geometry.setAttribute('aPlan', plans);
    geometry.setAttribute('aNow', now);
    geometry.setAttribute('aWas', was);
    geometry.instanceCount = 0;
    const material = new ShaderMaterial({
        vertexShader: MARK_VERTEX(motion),
        fragmentShader: MARK_FRAGMENT,
        uniforms: {
            uTime: { value: 0 },
            uSince: { value: 99 },
            uStagger: { value: stagger },
            uAspect: { value: 1 },
            uUnit: { value: VIEW.half },
            uA: { value: [0, 0, 0, 0] },
            uTones: { value: TONES.map((tone) => TONE_COLOURS[tone]) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    let changedAt = Number.NEGATIVE_INFINITY;
    let shown = 0;

    return {
        mesh,
        show(plan, seconds) {
            const count = Math.min(capacity, plan.length);
            for (let index = 0; index < capacity; index += 1) {
                const mark = index < count ? plan[index] : undefined;
                const kept = index < shown;
                was.setXY(
                    index,
                    kept ? now.getX(index) : 0,
                    kept ? now.getY(index) : mark ? TONES.indexOf(mark.tone) : 0,
                );
                if (mark) {
                    plans.setXYZW(index, mark.x, mark.y, mark.w, mark.h);
                    now.setXYZW(index, mark.level, TONES.indexOf(mark.tone), mark.shape, index / Math.max(1, count));
                } else {
                    now.setX(index, 0);
                }
            }
            // Marks that have left still fade out, so the draw covers whichever plan was longer.
            geometry.instanceCount = Math.max(count, shown);
            shown = count;
            plans.needsUpdate = true;
            now.needsUpdate = true;
            was.needsUpdate = true;
            changedAt = seconds;
        },
        update(tick, aspect, extra) {
            set(material, 'uTime', tick.seconds);
            set(material, 'uSince', tick.still ? 99 : tick.seconds - changedAt);
            set(material, 'uAspect', aspect);
            set(material, 'uA', extra);
        },
        dispose() {
            quad.dispose();
            geometry.dispose();
            material.dispose();
        },
    };
}

export function toolCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(VIEW.fov, 1, 0.1, 80);
    camera.position.set(0, 0, VIEW.distance);
    camera.lookAt(0, 0, 0);
    return camera;
}

/** A tool scene's camera never travels: it only breathes, a few hundredths of a unit, so the picture is alive. */
export function aimToolCamera(camera: PerspectiveCamera, tick: Tick): number {
    const aspect = tick.width / Math.max(1, tick.height);
    const drift = tick.still ? 0 : 1;
    camera.aspect = aspect;
    camera.position.set(
        Math.sin(tick.seconds * 0.11) * 0.18 * drift,
        Math.sin(tick.seconds * 0.07 + 1.3) * 0.08 * drift,
        VIEW.distance,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return aspect;
}
