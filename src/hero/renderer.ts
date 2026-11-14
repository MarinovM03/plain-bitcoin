import { hashBits } from '../chain/hash.ts';
import { hashMaterial } from '../chain/material.ts';
import { type Camera, FORMING, SLAB_YAW, slabBase, type Vec3, viewProjection } from '../chain/view.ts';
import type { Actor, ActorPose } from './actors.ts';
import {
    FLOOR_FRAGMENT,
    FLOOR_VERTEX,
    GHOST_FRAGMENT,
    MAX_BOXES,
    MOTE_FRAGMENT,
    MOTE_VERTEX,
    SLAB_FRAGMENT,
    SLAB_VERTEX,
} from './shaders.ts';

export interface DrawList {
    camera: Camera;
    /** Each tablet on stage with where it is right now. */
    slabs: readonly { actor: Actor; pose: ActorPose }[];
    /** 0 hides the forming block; 1 shows it fully. */
    ghost: number;
    /** Share of the motes gathered on the forming block, 0 to 1. */
    fill: number;
    seconds: number;
}

export interface Renderer {
    resize(width: number, height: number): void;
    draw(list: DrawList): void;
    dispose(): void;
}

const MOTES = 1500;
const KEY: Vec3 = [-0.5361, 0.7603, 0.3669];
const FLOOR_REACH = 60;

function linear(hex: string): [number, number, number] {
    return [1, 3, 5].map((start) => {
        const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
}

function display(hex: string): [number, number, number] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255) as [number, number, number];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('No shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

interface Program {
    handle: WebGLProgram;
    uniform(name: string): WebGLUniformLocation | null;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
    const handle = gl.createProgram();
    if (!handle) throw new Error('No program');
    const shaders = [compile(gl, gl.VERTEX_SHADER, vertex), compile(gl, gl.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl.attachShader(handle, shader);
    gl.linkProgram(handle);
    for (const shader of shaders) gl.deleteShader(shader);
    const locations = new Map<string, WebGLUniformLocation | null>();
    return {
        handle,
        uniform(name) {
            if (!locations.has(name)) locations.set(name, gl.getUniformLocation(handle, name));
            return locations.get(name) ?? null;
        },
    };
}

const POLL_MS = 16;

/**
 * Asking for a program's status makes the browser finish compiling it on the main thread, which on a phone is a
 * long freeze. Where the browser can compile in the background, wait for it to say it is done before asking.
 */
function linked(gl: WebGL2RenderingContext, programs: readonly Program[]): Promise<void> {
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    const check = () => {
        for (const { handle } of programs) {
            if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
                throw new Error(`Program: ${gl.getProgramInfoLog(handle) ?? ''}`);
            }
        }
    };
    if (!parallel) return Promise.resolve().then(check);
    return new Promise<void>((resolve, reject) => {
        const poll = () => {
            if (gl.isContextLost()) {
                reject(new Error('Context lost'));
                return;
            }
            const done = programs.every(({ handle }) =>
                gl.getProgramParameter(handle, parallel.COMPLETION_STATUS_KHR),
            );
            if (!done) {
                setTimeout(poll, POLL_MS);
                return;
            }
            try {
                check();
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        poll();
    });
}

/** A unit box standing on the floor: x and z from -0.5 to 0.5, y from 0 to 1, with a flat normal per face. */
function boxMesh(): Float32Array {
    const faces: [Vec3, Vec3, Vec3][] = [
        [
            [0, 0, 1],
            [1, 0, 0],
            [0, 1, 0],
        ],
        [
            [0, 0, -1],
            [-1, 0, 0],
            [0, 1, 0],
        ],
        [
            [1, 0, 0],
            [0, 0, -1],
            [0, 1, 0],
        ],
        [
            [-1, 0, 0],
            [0, 0, 1],
            [0, 1, 0],
        ],
        [
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ],
        [
            [0, -1, 0],
            [1, 0, 0],
            [0, 0, 1],
        ],
    ];
    const data: number[] = [];
    for (const [normal, across, up] of faces) {
        for (const [a, b] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, -1],
            [1, 1],
            [-1, 1],
        ] as const) {
            const x = (normal[0] + across[0] * a + up[0] * b) / 2;
            const y = (normal[1] + across[1] * a + up[1] * b) / 2 + 0.5;
            const z = (normal[2] + across[2] * a + up[2] * b) / 2;
            data.push(x, y, z, normal[0], normal[1], normal[2]);
        }
    }
    return new Float32Array(data);
}

// A fixed, seeded scatter: the motes are texture, so every visit and every still frame shows the same cloud.
function moteSeeds(): Float32Array {
    const seeds = new Float32Array(MOTES * 4);
    let state = 0x9e3779b9;
    for (let index = 0; index < seeds.length; index += 1) {
        state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
        state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
        state ^= state >>> 15;
        seeds[index] = (state >>> 0) / 4294967296;
    }
    return seeds;
}

export async function createRenderer(gl: WebGL2RenderingContext, ink: string): Promise<Renderer> {
    const slab = link(gl, SLAB_VERTEX, SLAB_FRAGMENT);
    const ghost = link(gl, SLAB_VERTEX, GHOST_FRAGMENT);
    const floor = link(gl, FLOOR_VERTEX, FLOOR_FRAGMENT);
    const motes = link(gl, MOTE_VERTEX, MOTE_FRAGMENT);
    await linked(gl, [slab, ghost, floor, motes]);
    const inkDisplay = display(ink);
    const cos = Math.cos(SLAB_YAW);
    const sin = Math.sin(SLAB_YAW);
    const keySlab: Vec3 = [KEY[0] * cos - KEY[2] * sin, KEY[1], KEY[0] * sin + KEY[2] * cos];
    const pool = slabBase(1.9);

    const boxArray = gl.createVertexArray();
    const boxBuffer = gl.createBuffer();
    gl.bindVertexArray(boxArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, boxMesh(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);

    const floorArray = gl.createVertexArray();
    const floorBuffer = gl.createBuffer();
    gl.bindVertexArray(floorArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
    const r = FLOOR_REACH;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-r, -r, r, -r, r, r, -r, -r, r, r, -r, r]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const moteArray = gl.createVertexArray();
    const moteBuffer = gl.createBuffer();
    gl.bindVertexArray(moteArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, moteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, moteSeeds(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const faces = new Map<string, WebGLTexture>();
    let width = 1;
    let height = 1;

    function faceOf(actor: Actor): WebGLTexture | null {
        const known = faces.get(actor.key);
        if (known) return known;
        const texture = gl.createTexture();
        if (!texture) return null;
        const bits = hashBits(actor.block.hash);
        const pixels = new Uint8Array(bits.length);
        for (let index = 0; index < bits.length; index += 1) pixels[index] = bits[index] === 1 ? 255 : 0;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 16, 16, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        faces.set(actor.key, texture);
        return texture;
    }

    function forget(live: ReadonlySet<string>): void {
        for (const [key, texture] of faces) {
            if (live.has(key)) continue;
            gl.deleteTexture(texture);
            faces.delete(key);
        }
    }

    function common(program: Program, list: DrawList, matrix: Float32Array, boxes: Boxes): void {
        gl.useProgram(program.handle);
        gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, matrix);
        gl.uniform3fv(program.uniform('uEye'), list.camera.eye as unknown as number[]);
        gl.uniform3fv(program.uniform('uInk'), inkDisplay);
        gl.uniform2f(program.uniform('uViewport'), width, height);
        gl.uniform2f(program.uniform('uYaw'), cos, sin);
        gl.uniform3fv(program.uniform('uKey'), KEY as unknown as number[]);
        gl.uniform3fv(program.uniform('uKeySlab'), keySlab as unknown as number[]);
        gl.uniform1f(program.uniform('uFogStart'), boxes.fogStart);
        gl.uniform1i(program.uniform('uBoxCount'), boxes.count);
        gl.uniform3fv(program.uniform('uBoxCentre[0]'), boxes.centres);
        gl.uniform3fv(program.uniform('uBoxHalf[0]'), boxes.halves);
        gl.uniform1fv(program.uniform('uBoxPresence[0]'), boxes.presence);
    }

    interface Boxes {
        count: number;
        centres: Float32Array;
        halves: Float32Array;
        presence: Float32Array;
        fogStart: number;
    }

    function boxesOf(list: DrawList): Boxes {
        const centres = new Float32Array(MAX_BOXES * 3);
        const halves = new Float32Array(MAX_BOXES * 3);
        const presence = new Float32Array(MAX_BOXES);
        const count = Math.min(MAX_BOXES, list.slabs.length);
        for (let index = 0; index < count; index += 1) {
            const pose = list.slabs[index]?.pose;
            if (!pose) continue;
            const base = slabBase(pose.offset);
            centres.set(
                [base[0] * cos - base[2] * sin, pose.lift + pose.side / 2, base[0] * sin + base[2] * cos],
                index * 3,
            );
            halves.set([pose.side / 2, pose.side / 2, pose.thick / 2], index * 3);
            presence[index] = pose.presence;
        }
        const { eye, target } = list.camera;
        const distance = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
        return { count, centres, halves, presence, fogStart: distance - 0.6 };
    }

    function drawSlabs(list: DrawList, mirror: 1 | -1): void {
        gl.uniform1f(slab.uniform('uMirror'), mirror);
        list.slabs.forEach(({ actor, pose }, index) => {
            if (pose.presence <= 0.001) return;
            const material = hashMaterial(actor.block.hash);
            const base = slabBase(pose.offset);
            gl.uniform3f(slab.uniform('uBase'), base[0], pose.lift, base[2]);
            gl.uniform3f(slab.uniform('uSize'), pose.side, pose.side, pose.thick);
            gl.uniform3fv(slab.uniform('uBody'), linear(material.body));
            gl.uniform3fv(slab.uniform('uInlay'), linear(material.inlay));
            gl.uniform1f(slab.uniform('uSeed'), (actor.block.height % 97) * 1.37);
            gl.uniform1f(slab.uniform('uCut'), material.tone === 'blank' ? 0 : 1);
            gl.uniform1f(slab.uniform('uInlayGloss'), material.tone === 'graphite' ? 0.75 : 0.4);
            gl.uniform1f(slab.uniform('uPresence'), pose.presence);
            gl.uniform1f(slab.uniform('uFlash'), pose.flash);
            gl.uniform1i(slab.uniform('uSelf'), index < MAX_BOXES ? index : -1);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, faceOf(actor));
            gl.uniform1i(slab.uniform('uBits'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        });
    }

    return {
        resize(nextWidth, nextHeight) {
            width = Math.max(1, nextWidth);
            height = Math.max(1, nextHeight);
        },
        draw(list) {
            const matrix = viewProjection(list.camera);
            const boxes = boxesOf(list);
            forget(new Set(list.slabs.map(({ actor }) => actor.key)));

            gl.viewport(0, 0, width, height);
            gl.clearColor(inkDisplay[0], inkDisplay[1], inkDisplay[2], 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.disable(gl.BLEND);

            gl.bindVertexArray(boxArray);
            common(slab, list, matrix, boxes);
            gl.disable(gl.CULL_FACE);
            drawSlabs(list, -1);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindVertexArray(floorArray);
            common(floor, list, matrix, boxes);
            gl.uniform2f(floor.uniform('uPool'), pool[0], pool[2]);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disable(gl.BLEND);

            gl.bindVertexArray(boxArray);
            gl.useProgram(slab.handle);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
            drawSlabs(list, 1);

            if (list.ghost > 0.001) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                gl.depthMask(false);
                gl.disable(gl.CULL_FACE);
                common(ghost, list, matrix, boxes);
                gl.uniform3f(ghost.uniform('uBase'), 0, 0, 0);
                gl.uniform3f(ghost.uniform('uSize'), FORMING.side, FORMING.side, FORMING.thick);
                gl.uniform1f(ghost.uniform('uMirror'), 1);
                gl.uniform1f(ghost.uniform('uGhost'), list.ghost * (0.4 + 0.6 * Math.min(1, list.fill)));
                gl.drawArrays(gl.TRIANGLES, 0, 36);

                gl.bindVertexArray(moteArray);
                gl.useProgram(motes.handle);
                gl.uniformMatrix4fv(motes.uniform('uViewProjection'), false, matrix);
                gl.uniform3f(motes.uniform('uSize'), FORMING.side, FORMING.side, FORMING.thick);
                gl.uniform2f(motes.uniform('uYaw'), cos, sin);
                gl.uniform2f(motes.uniform('uViewport'), width, height);
                gl.uniform1f(motes.uniform('uTime'), list.seconds);
                gl.uniform1f(motes.uniform('uFill'), list.fill);
                gl.uniform1f(motes.uniform('uPixels'), height / Math.tan(list.camera.fovY / 2));
                gl.uniform1f(motes.uniform('uGhost'), list.ghost);
                gl.drawArrays(gl.POINTS, 0, MOTES);
                gl.depthMask(true);
                gl.disable(gl.BLEND);
            }
            gl.bindVertexArray(null);
        },
        dispose() {
            for (const texture of faces.values()) gl.deleteTexture(texture);
            faces.clear();
            for (const program of [slab, ghost, floor, motes]) gl.deleteProgram(program.handle);
            for (const buffer of [boxBuffer, floorBuffer, moteBuffer]) gl.deleteBuffer(buffer);
            for (const array of [boxArray, floorArray, moteArray]) gl.deleteVertexArray(array);
        },
    };
}
