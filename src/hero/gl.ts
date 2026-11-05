import { TOKENS, WEATHER } from '../styles/tokens.ts';
import type { Camera } from './camera.ts';
import { hexRgb, normalMatrix, type Vec3 } from './gfx/math.ts';
import { type Mesh, STRIDE } from './gfx/mesh.ts';
import type { BufferBox } from './pointer.ts';
import type { Ground, Item, Shadow } from './scenes/types.ts';
import {
    COMPOSITE_FRAGMENT,
    FIELD_FRAGMENT,
    FULLSCREEN_VERTEX,
    GROUND_FRAGMENT,
    MAX_PLATES,
    MAX_SHADOWS,
    SOLID_FRAGMENT,
    SOLID_VERTEX,
} from './shaders.ts';
import { isSoftwareRenderer } from './tier.ts';

export class SoftwareRendererError extends Error {
    override name = 'SoftwareRendererError';
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;
export type Rect = [number, number, number, number];

export interface WeatherFrame {
    time: number;
    seed: number;
    warp: number;
    drift: number;
    contrast: number;
    intro: number;
    /** Origin x, y in CSS px and progress 0..1; progress < 0 means no pulse. */
    pulse: Vec3;
    /** Mounted plates, in viewport CSS px. */
    plates: readonly Rect[];
}

export interface SceneDraw {
    viewport: BufferBox;
    camera: Camera;
    ortho: boolean;
    items: readonly Item[];
    ground: Ground | null;
    shadows: readonly Shadow[];
    /** Current highlight strength per part, 0..1. */
    lift: ReadonlyMap<string, number>;
}

export interface Surface {
    /** Canvas size in device pixels. */
    width: number;
    height: number;
    /** Device pixels per CSS pixel actually drawn. */
    scale: number;
    /** Field texture size, and the CSS pixels each texel covers. */
    cells: [number, number];
    cell: number;
}

export interface Renderer {
    readonly ready: boolean;
    resize(cssWidth: number, cssHeight: number, scale: number): Surface;
    draw(weather: WeatherFrame, scene: SceneDraw | null): void;
    restore(): void;
    dispose(): void;
    /** Test hook: drop and bring back the context, as a GPU reset would. */
    simulateLoss(): void;
}

const CONTEXT: WebGLContextAttributes = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
};

/** CSS pixels per field texel: the field is soft continuous tone, so a coarse texture is plenty and keeps phones cool. */
export function fieldCell(cssWidth: number): number {
    return cssWidth < 640 ? 6 : 5;
}

export function surfaceFor(cssWidth: number, cssHeight: number, scale: number): Surface {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const css = (value: number) => (Number.isFinite(value) && value > 0 ? value : 1);
    const width = Math.max(1, Math.round(css(cssWidth) * s));
    const height = Math.max(1, Math.round(css(cssHeight) * s));
    const cell = fieldCell(css(cssWidth));
    return {
        width,
        height,
        scale: width / css(cssWidth),
        cell,
        cells: [Math.ceil(css(cssWidth) / cell) + 1, Math.ceil(css(cssHeight) / cell) + 1],
    };
}

/** Plate rects as a flat uniform array, the largest first, capped to what the shader holds. */
export function plateUniform(plates: readonly Rect[]): { data: Float32Array; count: number } {
    const kept = plates
        .filter((rect) => rect.every(Number.isFinite) && rect[2] > 0 && rect[3] > 0)
        .sort((a, b) => b[2] * b[3] - a[2] * a[3])
        .slice(0, MAX_PLATES);
    const data = new Float32Array(MAX_PLATES * 4);
    for (const [i, rect] of kept.entries()) data.set(rect, i * 4);
    return { data, count: kept.length };
}

interface Program {
    program: WebGLProgram;
    uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Uploaded {
    vbo: WebGLBuffer | null;
    ibo: WebGLBuffer | null;
    version: number;
    count: number;
    used: number;
}

/** Buffers no scene has drawn for this many frames are freed: a route's meshes go when its scene does. */
const PRUNE_FRAMES = 240;

const PALETTE = {
    void: hexRgb(TOKENS.void),
    deep: hexRgb(WEATHER.deep),
    mass: hexRgb(WEATHER.mass),
    teal: hexRgb(WEATHER.teal),
    crest: hexRgb(WEATHER.crest),
    plate: hexRgb(TOKENS.plate),
    well: hexRgb(TOKENS.well),
    btc: hexRgb(TOKENS.btc),
    sky: [0.5, 0.56, 0.64] as Vec3,
    ground: [0.12, 0.12, 0.13] as Vec3,
};
const KEY: Vec3 = (() => {
    const k: Vec3 = [-0.45, 0.8, 0.55];
    const length = Math.hypot(...k);
    return [k[0] / length, k[1] / length, k[2] / length];
})();

export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, allowSoftware: boolean): Renderer {
    const surface = canvas as HTMLCanvasElement;
    const context = (surface.getContext('webgl2', CONTEXT) ?? surface.getContext('webgl', CONTEXT)) as GL | null;
    if (!context) throw new Error('WebGL is not available');
    const gl: GL = context;
    if (!allowSoftware && isSoftwareRenderer(gl)) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        throw new SoftwareRendererError();
    }
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    let parallel = gl.getExtension('KHR_parallel_shader_compile');
    let field: Program;
    let composite: Program;
    let solid: Program;
    let ground: Program;
    let corners: WebGLBuffer | null = null;
    let target: WebGLFramebuffer | null = null;
    let texture: WebGLTexture | null = null;
    let linked = false;
    let size: Surface = surfaceFor(1, 1, 1);
    const uploads = new Map<number, Uploaded>();
    let drawn = 0;
    let groundMesh: Mesh | null = null;

    function shader(type: number, source: string): WebGLShader {
        const created = gl.createShader(type);
        if (!created) throw new Error('Shader could not be created');
        gl.shaderSource(created, source);
        gl.compileShader(created);
        return created;
    }

    function program(vertex: string, fragment: string, attributes: readonly string[]): Program {
        const created = gl.createProgram();
        if (!created) throw new Error('Program could not be created');
        gl.attachShader(created, shader(gl.VERTEX_SHADER, vertex));
        gl.attachShader(created, shader(gl.FRAGMENT_SHADER, fragment));
        for (const [i, name] of attributes.entries()) gl.bindAttribLocation(created, i, name);
        gl.linkProgram(created);
        return { program: created, uniforms: new Map() };
    }

    function build(): void {
        parallel = gl.getExtension('KHR_parallel_shader_compile');
        field = program(FULLSCREEN_VERTEX, FIELD_FRAGMENT, ['aCorner']);
        composite = program(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT, ['aCorner']);
        solid = program(SOLID_VERTEX, SOLID_FRAGMENT, ['aPos', 'aNormal', 'aCell']);
        ground = program(SOLID_VERTEX, GROUND_FRAGMENT, ['aPos', 'aNormal', 'aCell']);
        corners = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        target = null;
        texture = null;
        linked = false;
        uploads.clear();
    }

    function finishLink(): boolean {
        const all = [field, composite, solid, ground];
        if (parallel && !all.every(({ program: p }) => gl.getProgramParameter(p, parallel?.COMPLETION_STATUS_KHR ?? 0)))
            return false;
        for (const { program: p } of all) {
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Stage shaders did not link');
        }
        linked = true;
        return true;
    }

    function u(p: Program, name: string): WebGLUniformLocation | null {
        if (!p.uniforms.has(name)) p.uniforms.set(name, gl.getUniformLocation(p.program, name));
        return p.uniforms.get(name) ?? null;
    }

    /** Half floats keep the soft field free of banding; plain bytes still work, with the dither hiding the steps. */
    function allocate(w: number, h: number): void {
        if (webgl2 && gl.getExtension('EXT_color_buffer_float')) {
            const gl2 = gl as WebGL2RenderingContext;
            gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, w, h, 0, gl2.RGBA, gl2.HALF_FLOAT, null);
            return;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    function ensureTarget(): void {
        const [w, h] = size.cells;
        if (!texture) texture = gl.createTexture();
        if (!target) target = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        allocate(w, h);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function fullscreen(): void {
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function drawWeather(frame: WeatherFrame): void {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, size.cells[0], size.cells[1]);
        gl.useProgram(field.program);
        gl.uniform2f(u(field, 'uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u(field, 'uCell'), size.cell);
        gl.uniform1f(u(field, 'uTime'), frame.time);
        gl.uniform1f(u(field, 'uSeed'), frame.seed);
        gl.uniform1f(u(field, 'uWarp'), frame.warp);
        gl.uniform1f(u(field, 'uDrift'), frame.drift);
        fullscreen();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const plates = plateUniform(frame.plates);
        gl.viewport(0, 0, size.width, size.height);
        gl.useProgram(composite.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(u(composite, 'uField'), 0);
        gl.uniform2f(u(composite, 'uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u(composite, 'uCell'), size.cell);
        gl.uniform2f(u(composite, 'uRes'), size.width, size.height);
        gl.uniform1f(u(composite, 'uScale'), size.scale);
        gl.uniform1f(u(composite, 'uContrast'), frame.contrast);
        gl.uniform1f(u(composite, 'uIntro'), frame.intro);
        gl.uniform3fv(u(composite, 'uPulse'), frame.pulse);
        gl.uniform4fv(u(composite, 'uPlates'), plates.data);
        gl.uniform1f(u(composite, 'uPlateCount'), plates.count);
        gl.uniform3fv(u(composite, 'uVoid'), PALETTE.void);
        gl.uniform3fv(u(composite, 'uDeep'), PALETTE.deep);
        gl.uniform3fv(u(composite, 'uMass'), PALETTE.mass);
        gl.uniform3fv(u(composite, 'uTeal'), PALETTE.teal);
        gl.uniform3fv(u(composite, 'uCrest'), PALETTE.crest);
        gl.uniform3fv(u(composite, 'uPlate'), PALETTE.plate);
        gl.uniform3fv(u(composite, 'uBtc'), PALETTE.btc);
        fullscreen();
    }

    function bindMesh(mesh: Mesh): number {
        let entry = uploads.get(mesh.id);
        if (!entry) {
            entry = { vbo: gl.createBuffer(), ibo: gl.createBuffer(), version: 0, count: 0, used: drawn };
            uploads.set(mesh.id, entry);
        }
        entry.used = drawn;
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, entry.ibo);
        if (entry.version !== mesh.version) {
            gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.DYNAMIC_DRAW);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
            entry.version = mesh.version;
            entry.count = mesh.indices.length;
        }
        const bytes = STRIDE * 4;
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, bytes, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, bytes, 12);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, bytes, 24);
        return entry.count;
    }

    function common(p: Program, scene: SceneDraw): void {
        gl.useProgram(p.program);
        gl.uniformMatrix4fv(u(p, 'uViewProj'), false, scene.camera.viewProj);
        gl.uniform1f(u(p, 'uFill'), -1e9);
        gl.uniform1f(u(p, 'uVisible'), 1e9);
    }

    function drawGround(scene: SceneDraw, pool: Ground): void {
        groundMesh ??= groundPlane();
        common(ground, scene);
        const span = pool.radius * 6;
        gl.uniformMatrix4fv(
            u(ground, 'uModel'),
            false,
            new Float32Array([span, 0, 0, 0, 0, 1, 0, 0, 0, 0, span, 0, pool.x, pool.y, pool.z, 1]),
        );
        gl.uniformMatrix3fv(u(ground, 'uNormalM'), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
        gl.uniform3fv(u(ground, 'uWell'), PALETTE.well);
        gl.uniform3fv(u(ground, 'uPlate'), PALETTE.plate);
        gl.uniform4f(u(ground, 'uPool'), pool.x, pool.z, pool.radius, 0);
        const shadows = new Float32Array(MAX_SHADOWS * 4);
        const strength = new Float32Array(MAX_SHADOWS);
        for (const [i, shadow] of scene.shadows.slice(0, MAX_SHADOWS).entries()) {
            shadows.set([shadow.x, shadow.z, shadow.rx, shadow.rz], i * 4);
            strength[i] = shadow.strength;
        }
        gl.uniform4fv(u(ground, 'uShadows'), shadows);
        gl.uniform1fv(u(ground, 'uShadowK'), strength);
        const count = bindMesh(groundMesh);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }

    function drawScene(scene: SceneDraw): void {
        const box = scene.viewport;
        if (box.width <= 0 || box.height <= 0) return;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(box.x, box.y, box.width, box.height);
        gl.viewport(box.x, box.y, box.width, box.height);
        gl.clearColor(PALETTE.plate[0], PALETTE.plate[1], PALETTE.plate[2], 1);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        if (scene.ground) drawGround(scene, scene.ground);
        common(solid, scene);
        gl.uniform3fv(u(solid, 'uEye'), scene.camera.eye);
        gl.uniform3fv(u(solid, 'uToward'), scene.camera.toward);
        gl.uniform1f(u(solid, 'uOrtho'), scene.ortho ? 1 : 0);
        gl.uniform3fv(u(solid, 'uKey'), KEY);
        gl.uniform3fv(u(solid, 'uSky'), PALETTE.sky);
        gl.uniform3fv(u(solid, 'uGround'), PALETTE.ground);
        gl.uniform3fv(u(solid, 'uBtc'), PALETTE.btc);
        gl.uniform1f(u(solid, 'uGroundY'), scene.ground?.y ?? -1e6);
        for (const item of scene.items) {
            if (item.hidden) continue;
            gl.uniformMatrix4fv(u(solid, 'uModel'), false, item.model);
            gl.uniformMatrix3fv(u(solid, 'uNormalM'), false, normalMatrix(item.model));
            gl.uniform3fv(u(solid, 'uColor'), item.color);
            gl.uniform3fv(u(solid, 'uFillColor'), item.fill?.color ?? item.color);
            gl.uniform1f(u(solid, 'uFill'), item.fill ? item.fill.count : -1e9);
            gl.uniform1f(u(solid, 'uVisible'), item.fill?.visible ?? 1e9);
            gl.uniform1f(u(solid, 'uLift'), item.part ? (scene.lift.get(item.part) ?? 0) : 0);
            gl.uniform1f(u(solid, 'uGlow'), item.glow ?? 0);
            const count = bindMesh(item.mesh);
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
        }
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
    }

    build();

    return {
        get ready() {
            return linked || finishLink();
        },
        resize(cssWidth, cssHeight, scale) {
            size = surfaceFor(cssWidth, cssHeight, scale);
            canvas.width = size.width;
            canvas.height = size.height;
            ensureTarget();
            return size;
        },
        draw(frame, scene) {
            if (!linked || gl.isContextLost()) return;
            drawn += 1;
            drawWeather(frame);
            if (scene) drawScene(scene);
            if (drawn % PRUNE_FRAMES === 0) {
                for (const [id, entry] of uploads) {
                    if (drawn - entry.used < PRUNE_FRAMES) continue;
                    gl.deleteBuffer(entry.vbo);
                    gl.deleteBuffer(entry.ibo);
                    uploads.delete(id);
                }
            }
        },
        restore() {
            build();
            ensureTarget();
        },
        dispose() {
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
        simulateLoss() {
            const lose = gl.getExtension('WEBGL_lose_context');
            if (!lose) return;
            lose.loseContext();
            setTimeout(() => lose.restoreContext(), 300);
        },
    };
}

function groundPlane(): Mesh {
    const data = new Float32Array([
        -0.5, 0, -0.5, 0, 1, 0, -1, 0.5, 0, -0.5, 0, 1, 0, -1, 0.5, 0, 0.5, 0, 1, 0, -1, -0.5, 0, 0.5, 0, 1, 0, -1,
    ]);
    return {
        id: -1,
        data,
        indices: new Uint16Array([0, 3, 2, 0, 2, 1]),
        bounds: { min: [-0.5, 0, -0.5], max: [0.5, 0, 0.5] },
        version: 1,
    };
}
