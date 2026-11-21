import {
    AdditiveBlending,
    BoxGeometry,
    Color,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    PerspectiveCamera,
    Scene,
    ShaderMaterial,
    Vector3,
} from 'three';
import type { WallInput } from '../bus.ts';
import { disposeTree, ORANGE, WHITE } from '../glow.ts';
import { approach, type Frame, fitDistance, type Machine } from '../machine.ts';

/** 300 wide, 280 deep, 250 layers high: one cell for each of the 21,000,000 bitcoin. */
const CELLS = new Vector3(300, 250, 280);
const PER_LAYER = 300 * 280;
const SIZE = new Vector3(3, 2.5, 2.8).multiplyScalar(0.62);
const LOOP_SECONDS = 24;
/** How close the camera comes to the row being mined, in scene units: a few dozen coins across. */
const CLOSEST = 0.32;
const CENTRE = new Vector3(0, -0.1, 0);

const VERTEX = /* glsl */ `
varying vec3 vCell;
varying vec3 vNormal;
uniform vec3 uCells;
uniform vec3 uSize;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vCell = (world.xyz + uSize * 0.5) / uSize * uCells;
    vNormal = normal;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vCell;
varying vec3 vNormal;
uniform vec3 uCells;
uniform vec3 uLit;
uniform vec3 uNew;
uniform float uPartial;
uniform float uTop;
uniform vec3 uEmpty;
float grain(vec3 cell) { return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
    vec3 n = normalize(vNormal);
    vec2 face = abs(n.y) > 0.5 ? vCell.xz : abs(n.x) > 0.5 ? vCell.zy : vCell.xy;
    vec3 cell = min(floor(vCell - n * 0.5), uCells - 1.0);
    vec2 inside = fract(face);
    vec2 edge = fwidth(face);
    float pixel = max(edge.x, edge.y);
    vec2 border = smoothstep(vec2(0.0), edge * 1.2, inside) * smoothstep(vec2(0.0), edge * 1.2, 1.0 - inside);
    // Once a cell is smaller than a few pixels its lines and grain would only shimmer, so the face goes smooth.
    float far = smoothstep(0.08, 0.3, pixel);
    float gap = mix(border.x * border.y, 1.0, far);
    float tone = mix(0.92 + 0.08 * grain(cell), 1.0, far);
    float shade = abs(n.y) > 0.5 ? 1.0 : abs(n.x) > 0.5 ? 0.74 : 0.86;
    if (abs(n.y) < 0.5) shade *= 0.88 + 0.12 * clamp(vCell.y / uCells.y, 0.0, 1.0);
    vec3 color = uLit * tone * shade;
    if (cell.y > uTop - 0.5) {
        float index = cell.z * uCells.x + cell.x;
        color = index < uPartial ? uLit * tone * shade + uNew * 0.03 : uEmpty * shade;
    }
    gl_FragColor = vec4(color * (0.5 + 0.5 * gap), 1.0);
    #include <colorspace_fragment>
}
`;

function material(): ShaderMaterial {
    return new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
            uCells: { value: CELLS },
            uSize: { value: SIZE },
            uLit: { value: ORANGE },
            uNew: { value: WHITE },
            uPartial: { value: 0 },
            uTop: { value: -1 },
            uEmpty: { value: new Color('#3b4049') },
        },
    });
}

function ease(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Every bitcoin there will ever be, as one block of 21,000,000 cells stacked in layers. The issued coins fill it
 * from the bottom; the top layer is the one being mined now, lit up to the newest block. The empty frame above is
 * what is still to come.
 */
export function createWall(first: WallInput, _page: boolean): Machine<WallInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.01, 60);
    const box = new BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const body = new Mesh(box, material());
    const frame = new LineSegments(
        new EdgesGeometry(new BoxGeometry(SIZE.x, SIZE.y, SIZE.z)),
        new LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.35, blending: AdditiveBlending }),
    );
    scene.add(body, frame);

    const focus = new Vector3();
    const aim = new Vector3();
    const look = new Vector3();
    let input = first;
    let held: number | null = null;

    function fill(): void {
        const coins = Math.round(Math.min(1, Math.max(0, input.issued)) * PER_LAYER * CELLS.y);
        const full = Math.min(CELLS.y, Math.floor(coins / PER_LAYER));
        const partial = coins - full * PER_LAYER;
        const layerHeight = SIZE.y / CELLS.y;
        const bottom = -SIZE.y / 2;
        const layers = full + (partial > 0 ? 1 : 0);
        body.scale.set(SIZE.x, Math.max(1e-4, layers * layerHeight), SIZE.z);
        body.position.y = bottom;
        const uniforms = (body.material as ShaderMaterial).uniforms;
        if (uniforms.uPartial) uniforms.uPartial.value = partial;
        if (uniforms.uTop) uniforms.uTop.value = partial > 0 ? full : CELLS.y + 1;
        const row = Math.floor(partial / CELLS.x);
        const column = partial % CELLS.x;
        focus.set(
            -SIZE.x / 2 + ((column + 0.5) / CELLS.x) * SIZE.x,
            bottom + (full + 1) * layerHeight,
            -SIZE.z / 2 + ((row + 0.5) / CELLS.z) * SIZE.z,
        );
    }
    fill();

    function frameScene(frame: Frame): void {
        const phase = frame.still ? 0 : (frame.seconds / LOOP_SECONDS) % 1;
        const auto = ease(phase < 0.5 ? (phase - 0.12) * 3.2 : (0.92 - phase) * 3.2);
        const wanted = input.zoom ?? null;
        held = wanted === null ? null : frame.still || held === null ? wanted : approach(held, wanted, 6, frame.delta);
        const dive = held === null ? auto : held;
        const swing = frame.turn + frame.pointer.x * 0.35 + 0.7 + (frame.still ? 0 : frame.seconds * 0.06);
        // The whole block fits the box; then each step of the zoom closes the same share of the distance, so
        // the dive feels even from the first notch to the last.
        const fit = fitDistance(1.3, camera.fov, frame.aspect * 1.05);
        const distance = fit * (CLOSEST / fit) ** dive;
        aim.copy(CENTRE).lerp(focus, Math.min(1, dive * 1.8));
        look.set(Math.sin(swing), 0.62 - dive * 0.12 + frame.pointer.y * 0.1, Math.cos(swing)).normalize();
        camera.position.copy(aim).addScaledVector(look, distance);
        camera.lookAt(aim);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
    }

    return {
        scene,
        camera,
        set(next) {
            input = next;
            fill();
        },
        frame: frameScene,
        dispose() {
            disposeTree(scene);
        },
    };
}
