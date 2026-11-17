import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    type Material,
    type Object3D,
    Points,
    ShaderMaterial,
} from 'three';
import { TOKENS } from '../styles/tokens.ts';

export const ORANGE = new Color(TOKENS.btc);
export const WHITE = new Color(TOKENS.ink);
export const DIM = new Color(TOKENS.edge);
export const VOID = new Color(TOKENS.void);

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aTint;
uniform float uPixels;
varying vec4 vTint;
void main() {
    vTint = aTint;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize * uPixels / max(0.001, -view.z);
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vTint;
void main() {
    vec2 at = gl_PointCoord * 2.0 - 1.0;
    float r = dot(at, at);
    if (r > 1.0) discard;
    float core = smoothstep(0.18, 0.0, r);
    float halo = pow(1.0 - r, 2.2) * 0.55;
    gl_FragColor = vec4(vTint.rgb * (core * 1.6 + halo), (core + halo) * vTint.a);
    #include <colorspace_fragment>
}
`;

/** A cloud of soft lights that add up where they overlap: the glow without a bloom pass. */
export class GlowPoints {
    readonly points: Points;
    readonly position: Float32Array;
    readonly size: Float32Array;
    readonly tint: Float32Array;
    private readonly geometry: BufferGeometry;
    private readonly material: ShaderMaterial;

    constructor(capacity: number) {
        this.position = new Float32Array(capacity * 3);
        this.size = new Float32Array(capacity);
        this.tint = new Float32Array(capacity * 4);
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute('position', new BufferAttribute(this.position, 3));
        this.geometry.setAttribute('aSize', new BufferAttribute(this.size, 1));
        this.geometry.setAttribute('aTint', new BufferAttribute(this.tint, 4));
        this.material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: { uPixels: { value: 600 } },
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
        });
        this.points = new Points(this.geometry, this.material);
        this.points.frustumCulled = false;
    }

    put(index: number, x: number, y: number, z: number, size: number, color: Color, alpha: number): void {
        this.position[index * 3] = x;
        this.position[index * 3 + 1] = y;
        this.position[index * 3 + 2] = z;
        this.size[index] = size;
        this.tint[index * 4] = color.r;
        this.tint[index * 4 + 1] = color.g;
        this.tint[index * 4 + 2] = color.b;
        this.tint[index * 4 + 3] = alpha;
    }

    hide(index: number): void {
        this.size[index] = 0;
        this.tint[index * 4 + 3] = 0;
    }

    /** Pixels per world unit at distance 1: keeps a light the same size at any canvas height. */
    flush(pixels: number): void {
        const uniform = this.material.uniforms.uPixels;
        if (uniform) uniform.value = pixels;
        for (const name of ['position', 'aSize', 'aTint']) {
            const attribute = this.geometry.getAttribute(name);
            attribute.needsUpdate = true;
        }
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}

/** Frees every geometry and material under a scene. */
export function disposeTree(root: Object3D): void {
    root.traverse((node) => {
        const mesh = node as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of materials) material.dispose();
    });
}

/** A fixed, seeded scatter, so every visit and every still frame shows the same arrangement. */
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
