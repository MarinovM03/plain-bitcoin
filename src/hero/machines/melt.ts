import { DoubleSide, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import type { MeltInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, seeds, WHITE } from '../glow.ts';
import { approach, type Frame, type Machine } from '../machine.ts';

const EMBERS = 160;

const VERTEX = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec3 bent = position;
    bent.z += sin(position.x * 2.2 + uTime * 0.6) * 0.05 + cos(position.y * 3.0 + uTime * 0.4) * 0.03;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uGone;
uniform vec3 uInk;
uniform vec3 uEdge;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
}

void main() {
    vec2 p = vUv * vec2(2.2, 1.0);
    float melt = fbm(p * 2.6) * 0.75 + (1.0 - vUv.y) * 0.25;
    float cut = uGone * 1.08 - 0.04;
    if (melt < cut) discard;
    vec2 c = vUv - 0.5;
    float frame = step(0.42, max(abs(c.x) * 0.9, abs(c.y) * 1.0));
    float rings = 0.5 + 0.5 * sin(length(c * vec2(2.2, 1.0) - vec2(0.38, 0.0)) * 90.0);
    float lines = 0.5 + 0.5 * sin((vUv.x + vUv.y * 0.6) * 160.0);
    float seal = smoothstep(0.17, 0.16, length((c - vec2(-0.26, 0.0)) * vec2(2.2, 1.0)));
    vec3 paper = mix(uInk * 0.22, uInk * 0.34, rings * 0.5 + lines * 0.15);
    paper = mix(paper, uInk * 0.52, frame * 0.6 + seal * 0.5);
    float burn = smoothstep(cut + 0.05, cut, melt);
    vec3 color = mix(paper, uEdge * 2.4, burn);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}
`;

/**
 * A banknote eaten away by inflation: the part that is gone is the buying power the money lost since its year.
 * Embers drift off the burning edge.
 */
export function createMelt(first: MeltInput, page: boolean): Machine<MeltInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 30);
    const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: DoubleSide,
        uniforms: {
            uTime: { value: 0 },
            uGone: { value: 0 },
            uInk: { value: WHITE },
            uEdge: { value: ORANGE },
        },
    });
    const note = new Mesh(new PlaneGeometry(2.2, 1, 64, 32), material);
    scene.add(note);
    const embers = new GlowPoints(EMBERS);
    scene.add(embers.points);
    const scatter = seeds(EMBERS * 3, 17);

    let input = first;
    let gone = 0;

    function frame(frame: Frame): void {
        const goal = 1 - Math.min(1, Math.max(0, input.kept));
        gone = frame.still ? goal : approach(gone, goal, 0.9, frame.delta);
        const u = material.uniforms;
        (u.uGone as { value: number }).value = gone;
        (u.uTime as { value: number }).value = frame.seconds;

        for (let i = 0; i < EMBERS; i += 1) {
            const a = scatter[i * 3] ?? 0;
            const b = scatter[i * 3 + 1] ?? 0;
            const c = scatter[i * 3 + 2] ?? 0;
            const life = (frame.seconds * (0.12 + c * 0.1) + a) % 1;
            const visible = gone > 0.02 && !frame.still;
            if (!visible) {
                embers.hide(i);
                continue;
            }
            embers.put(
                i,
                (b - 0.5) * 2.2,
                -0.5 + gone * 0.9 + life * 1.4,
                0.05 + c * 0.2,
                0.05 + c * 0.06,
                ORANGE,
                (1 - life) * 0.8,
            );
        }

        note.rotation.y =
            -0.35 + frame.turn + frame.pointer.x * 0.25 + (frame.still ? 0 : Math.sin(frame.seconds * 0.3) * 0.1);
        note.rotation.x = -0.25 + frame.pointer.y * 0.15;
        const distance = page ? 3.4 : 3.1;
        camera.position.set(0, 0.1, frame.aspect < 1 ? distance / frame.aspect ** 0.7 : distance);
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        embers.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set(next) {
            input = next;
        },
        frame,
        dispose() {
            embers.dispose();
            disposeTree(scene);
        },
    };
}
