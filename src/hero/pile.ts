import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { PILE_BASE } from '../chain/view.ts';
import { GLOW, seeds, type Tick } from './kit.ts';

/** Ten layers of ten by ten: the most points the stack ever holds. */
const SIDE = 10;
export const PILE_POINTS = SIDE * SIDE * SIDE;
const SPACING = 0.085;
/** A point takes this long to fly in or out. */
const FLIGHT_SECONDS = 0.55;
/** The front of the stack moves at least this many points a second, and faster when it has far to go. */
const HEAD_SPEED = 60;

const VERTEX = /* glsl */ `
attribute vec3 aHome;
attribute float aLive;
attribute float aSeed;
uniform vec3 uBase;
uniform vec2 uFrom;
uniform float uTime;
uniform float uPixels;
varying float vAlpha;
varying float vHot;

void main() {
    float turn = uTime * 0.06;
    vec3 local = vec3(aHome.x * cos(turn) + aHome.z * sin(turn), aHome.y, -aHome.x * sin(turn) + aHome.z * cos(turn));
    local.y += sin(uTime * 0.9 + aSeed * 6.2832) * 0.006;
    vec4 home = projectionMatrix * viewMatrix * vec4(uBase + local, 1.0);
    vec4 from = vec4(uFrom * home.w, home.z, home.w);
    float eased = aLive * aLive * (3.0 - 2.0 * aLive);
    vec4 at = mix(from, home, eased);
    at.y += sin(eased * 3.14159) * (0.1 + 0.2 * aSeed) * home.w;
    at.x += sin(eased * 3.14159) * (aSeed - 0.5) * 0.12 * home.w;
    gl_Position = at;
    gl_PointSize = max(2.0, uPixels * 0.021 / home.w) * mix(1.9, 1.0, eased);
    vAlpha = smoothstep(0.0, 0.12, aLive);
    vHot = 1.0 - eased;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColour;
varying float vAlpha;
varying float vHot;

void main() {
    float disc = smoothstep(0.5, 0.34, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColour * (0.62 + 0.9 * vHot), disc * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export interface PileLayer {
    readonly points: Points;
    update(tick: Tick, pixels: number): void;
    dispose(): void;
}

/**
 * The converter's amount as a stack of points on the floor. Points fly in from where the amount was typed, the
 * bottom layer first, and fly back out when the amount shrinks.
 */
export function createPile(): PileLayer {
    const homes = new Float32Array(PILE_POINTS * 3);
    const half = ((SIDE - 1) * SPACING) / 2;
    for (let index = 0; index < PILE_POINTS; index += 1) {
        const layer = Math.floor(index / (SIDE * SIDE));
        const cell = index % (SIDE * SIDE);
        homes.set(
            [(cell % SIDE) * SPACING - half, 0.05 + layer * SPACING, Math.floor(cell / SIDE) * SPACING - half],
            index * 3,
        );
    }
    const live = new BufferAttribute(new Float32Array(PILE_POINTS), 1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(PILE_POINTS * 3), 3));
    geometry.setAttribute('aHome', new BufferAttribute(homes, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds(PILE_POINTS, 0x7f4a7c15), 1));
    geometry.setAttribute('aLive', live);
    const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
            uBase: { value: [...PILE_BASE] },
            uFrom: { value: [0, 0] },
            uTime: { value: 0 },
            uPixels: { value: 1 },
            uColour: { value: GLOW },
        },
        transparent: true,
        depthWrite: false,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 4;
    points.visible = false;
    let head = 0;
    let moving = false;

    return {
        points,
        update(tick, pixels) {
            const delta = tick.delta;
            const goal = Math.min(PILE_POINTS, Math.max(0, tick.pile?.points ?? 0));
            const uniforms = material.uniforms;
            if (uniforms.uTime) uniforms.uTime.value = tick.seconds;
            if (uniforms.uPixels) uniforms.uPixels.value = pixels;
            if (tick.pile && uniforms.uFrom) uniforms.uFrom.value = [...tick.pile.from];
            if (tick.still) head = goal;
            else if (head !== goal) {
                const reach = Math.max(HEAD_SPEED, Math.abs(goal - head) * 5) * delta;
                head = Math.abs(goal - head) <= reach ? goal : head + Math.sign(goal - head) * reach;
            }
            if (head === goal && !moving && !tick.still) {
                points.visible = goal > 0;
                return;
            }
            const values = live.array;
            const pace = tick.still ? 1 : delta / FLIGHT_SECONDS;
            moving = false;
            let shown = false;
            for (let index = 0; index < PILE_POINTS; index += 1) {
                const want = index < head ? 1 : 0;
                const now = values[index] ?? 0;
                const next = now < want ? Math.min(1, now + pace) : Math.max(0, now - pace);
                values[index] = next;
                if (next !== want) moving = true;
                if (next > 0) shown = true;
            }
            live.needsUpdate = true;
            points.visible = shown;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
