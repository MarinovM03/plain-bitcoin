import {
    BufferAttribute,
    BufferGeometry,
    Color,
    type PerspectiveCamera,
    Points,
    type Scene,
    ShaderMaterial,
    type Texture,
} from 'three';
import { FACE_CELLS, HASH_BITS, hashBits } from '../chain/hash.ts';
import type { Camera } from '../chain/view.ts';
import { TOKENS } from '../styles/tokens.ts';
import type { Actor, ActorPose } from './actors.ts';
import type { Pile } from './bus.ts';

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
    /** Seconds since the last frame; 0 for a single still frame. */
    delta: number;
    width: number;
    height: number;
    /** Height of the drawing buffer in pixels. */
    pixels: number;
    /** Nothing may be mid-move: reduced motion, or a single frame drawn while the loop is parked. */
    still: boolean;
    /** The newest block's hash: the squares in the air are its 256 bits. */
    hash: string | null;
    chain: ChainDraw;
    pile: Pile | null;
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
