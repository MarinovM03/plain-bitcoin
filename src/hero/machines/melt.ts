import {
    CanvasTexture,
    DoubleSide,
    Group,
    Mesh,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    SRGBColorSpace,
} from 'three';
import { TOKENS } from '../../styles/tokens.ts';
import type { MeltInput } from '../bus.ts';
import { disposeTree, GlowPoints, ORANGE, seeds } from '../glow.ts';
import { approach, type Frame, fitDistance, type Machine } from '../machine.ts';

const NOTES = 3;
const WIDTH = 2.2;
const HEIGHT = 1;
const EMBERS = 140;

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uLift;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec3 bent = position;
    bent.z += sin(position.x * 1.6 + uTime * 0.5 + uLift * 3.0) * 0.04 + position.x * position.x * 0.03;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uGone;
uniform float uSeed;
uniform vec3 uEdge;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
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
    // Burns in from the right-hand corner, ragged, as paper does.
    float reach = length((vUv - vec2(1.05, 0.0)) * vec2(1.0, 0.7));
    float melt = fbm(vUv * vec2(5.0, 2.4)) * 0.45 + reach * 0.7;
    float cut = mix(0.0, 1.35, uGone);
    if (melt < cut) discard;
    vec3 paper = texture2D(uMap, vUv).rgb;
    float scorch = smoothstep(cut + 0.12, cut + 0.02, melt);
    float flame = smoothstep(cut + 0.035, cut, melt);
    vec3 color = mix(paper, vec3(0.06), scorch * 0.85);
    color = mix(color, uEdge * 2.6, flame);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}
`;

/** The face of a banknote, drawn once in 2D: a frame, a rosette, a seal and the currency's sign. */
function noteTexture(symbol: string, face: boolean, page: boolean): CanvasTexture {
    const width = 1024;
    const height = Math.round(width / (WIDTH / HEIGHT));
    // A tile is small, so its notes are drawn at half the pixels: the same picture for a quarter of the work.
    const scale = page ? 1 : 0.5;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const c = canvas.getContext('2d');
    if (c) {
        c.scale(scale, scale);
        const paper = c.createLinearGradient(0, 0, width, height);
        paper.addColorStop(0, '#cfd9e2');
        paper.addColorStop(1, '#a9bccb');
        c.fillStyle = paper;
        c.fillRect(0, 0, width, height);
        c.strokeStyle = '#4b6174';
        c.lineWidth = 3;
        for (let inset = 18; inset <= 34; inset += 8) c.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        c.globalAlpha = 0.35;
        c.lineWidth = 1.2;
        for (let ring = 0; ring < 46; ring += 1) {
            c.beginPath();
            c.ellipse(width * 0.68, height / 2, 40 + ring * 4.2, 30 + ring * 3.1, ring * 0.07, 0, Math.PI * 2);
            c.stroke();
        }
        for (let line = 0; line < 60; line += 1) {
            c.beginPath();
            c.moveTo(60, 70 + line * 5.4);
            c.bezierCurveTo(260, 40 + line * 6, 380, 110 + line * 4.6, 520, 70 + line * 5.4);
            c.stroke();
        }
        c.globalAlpha = 1;
        if (!face) {
            const texture = new CanvasTexture(canvas);
            texture.colorSpace = SRGBColorSpace;
            return texture;
        }
        c.fillStyle = '#7d93a6';
        c.beginPath();
        c.arc(width * 0.24, height * 0.52, height * 0.24, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2f4254';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `700 ${Math.round(height * 0.34)}px ${TOKENS.fontDisplay}`;
        c.fillText(symbol, width * 0.24, height * 0.54);
        c.font = `700 ${Math.round(height * 0.2)}px ${TOKENS.fontMono}`;
        c.textAlign = 'right';
        c.fillText(`${symbol}100`, width - 60, 92);
        c.fillText(`${symbol}100`, width - 60, height - 80);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

/**
 * A small stack of banknotes in the money's own currency, burned back by inflation: the share of each note that
 * is gone is the buying power the money has lost since its year. Embers lift off the burning edge.
 */
export function createMelt(first: MeltInput, page: boolean): Machine<MeltInput> {
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 30);
    const stack = new Group();
    scene.add(stack);
    const geometry = new PlaneGeometry(WIDTH, HEIGHT, 48, 20);
    let symbol = first.symbol;
    let texture = noteTexture(symbol, true, page);
    const plain = noteTexture(symbol, false, page);
    const notes: ShaderMaterial[] = [];
    for (let i = 0; i < NOTES; i += 1) {
        const material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            side: DoubleSide,
            uniforms: {
                uMap: { value: i === 0 ? texture : plain },
                uTime: { value: 0 },
                uLift: { value: i },
                uGone: { value: 0 },
                uSeed: { value: i * 17.3 },
                uEdge: { value: ORANGE },
            },
        });
        notes.push(material);
        const note = new Mesh(geometry, material);
        note.position.set(i * 0.06, -i * 0.05, -i * 0.05);
        note.rotation.z = (i - 1) * 0.035;
        stack.add(note);
    }
    const embers = new GlowPoints(EMBERS);
    scene.add(embers.points);
    const scatter = seeds(EMBERS * 3, 17);

    let input = first;
    let gone = 0;

    function set(next: MeltInput): void {
        input = next;
        if (next.symbol === symbol) return;
        symbol = next.symbol;
        texture.dispose();
        texture = noteTexture(symbol, true, page);
        const front = notes[0];
        if (front) (front.uniforms.uMap as { value: CanvasTexture }).value = texture;
    }

    function frame(frame: Frame): void {
        const goal = 1 - Math.min(1, Math.max(0, input.kept));
        gone = frame.still ? goal : approach(gone, goal, 0.9, frame.delta);
        for (const [i, material] of notes.entries()) {
            (material.uniforms.uGone as { value: number }).value = Math.min(1, gone * (1 + i * 0.04));
            (material.uniforms.uTime as { value: number }).value = frame.seconds;
        }

        for (let i = 0; i < EMBERS; i += 1) {
            const a = scatter[i * 3] ?? 0;
            const b = scatter[i * 3 + 1] ?? 0;
            const c = scatter[i * 3 + 2] ?? 0;
            const life = (frame.seconds * (0.14 + c * 0.12) + a) % 1;
            if (gone < 0.02 || frame.still) {
                embers.hide(i);
                continue;
            }
            const edgeX = WIDTH / 2 - gone * WIDTH * 0.9 + (b - 0.5) * 0.5;
            embers.put(
                i,
                edgeX + life * 0.3,
                -0.3 + b * 0.8 + life * 1.3,
                0.08 + c * 0.25,
                0.04 + c * 0.05,
                ORANGE,
                (1 - life) * 0.85,
            );
        }

        stack.rotation.y =
            -0.38 + frame.turn * 0.7 + frame.pointer.x * 0.2 + (frame.still ? 0 : Math.sin(frame.seconds * 0.3) * 0.08);
        stack.rotation.x = -0.32 + frame.pointer.y * 0.12;
        const distance = fitDistance(1.25, camera.fov, frame.aspect) * (page ? 1.02 : 0.92);
        camera.position.set(0, 0.15, distance);
        camera.lookAt(0, 0, 0);
        camera.aspect = frame.aspect;
        camera.updateProjectionMatrix();
        embers.flush((camera.projectionMatrix.elements[5] ?? 1) * frame.pixels * 0.5);
    }

    return {
        scene,
        camera,
        set,
        frame,
        dispose() {
            texture.dispose();
            plain.dispose();
            embers.dispose();
            disposeTree(scene);
        },
    };
}
