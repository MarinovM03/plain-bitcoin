import { TOKENS } from '../styles/tokens.ts';
import { CONTOUR_FRAGMENT, FIELD_FRAGMENT, FULLSCREEN_VERTEX, MAX_PLATES } from './shaders.ts';
import { isSoftwareRenderer } from './tier.ts';

export class SoftwareRendererError extends Error {
    override name = 'SoftwareRendererError';
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;
type Vec3 = readonly [number, number, number];
export type Rect = [number, number, number, number];

export interface WeatherFrame {
    time: number;
    seed: number;
    warp: number;
    drift: number;
    bands: number;
    glow: number;
    scroll: number;
    intro: number;
    /** Origin x, y in CSS px and progress 0..1; progress < 0 means no pulse. */
    pulse: Vec3;
    /** Pointer x, y in CSS px and strength 0..1. */
    light: Vec3;
    /** Mounted plates, in document CSS px. */
    plates: readonly Rect[];
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
    draw(weather: WeatherFrame): void;
    restore(): void;
    dispose(): void;
    /** Test hook: drop and bring back the context, as a GPU reset would. */
    simulateLoss(): void;
}

const CONTEXT: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
};

const FIELD_UNIFORMS = [
    'uCells',
    'uCell',
    'uTime',
    'uSeed',
    'uWarp',
    'uDrift',
    'uScroll',
    'uLight',
    'uPlates',
    'uPlateCount',
] as const;
const CONTOUR_UNIFORMS = [
    'uField',
    'uCells',
    'uCell',
    'uRes',
    'uScale',
    'uBands',
    'uGlow',
    'uIntro',
    'uPulse',
    'uLight',
    'uVoid',
    'uSmoke',
    'uLine',
    'uIndex',
    'uBtc',
] as const;

export function hexRgb(hex: string): Vec3 {
    const value = Number.parseInt(hex.slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** CSS pixels per field texel: the isobars are smooth curves, so a coarse field is enough and keeps phones cool. */
export function fieldCell(cssWidth: number): number {
    return cssWidth < 640 ? 5 : 4;
}

export function surfaceFor(cssWidth: number, cssHeight: number, scale: number): Surface {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const width = Math.max(1, Math.round(cssWidth * s));
    const height = Math.max(1, Math.round(cssHeight * s));
    const cell = fieldCell(cssWidth);
    return {
        width,
        height,
        scale: width / Math.max(1, cssWidth),
        cell,
        cells: [Math.ceil(cssWidth / cell) + 2, Math.ceil(cssHeight / cell) + 2],
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
    let contour: Program;
    let corners: WebGLBuffer | null = null;
    let target: WebGLFramebuffer | null = null;
    let texture: WebGLTexture | null = null;
    let linked = false;
    let size: Surface = surfaceFor(1, 1, 1);
    const palette = {
        void: hexRgb(TOKENS.void),
        smoke: hexRgb(TOKENS.smoke),
        line: hexRgb(TOKENS.isobar),
        index: hexRgb(TOKENS.isobarIndex),
        btc: hexRgb(TOKENS.btc),
    };

    function shader(type: number, source: string): WebGLShader {
        const created = gl.createShader(type);
        if (!created) throw new Error('Shader could not be created');
        gl.shaderSource(created, source);
        gl.compileShader(created);
        return created;
    }

    function program(fragment: string): Program {
        const created = gl.createProgram();
        if (!created) throw new Error('Program could not be created');
        gl.attachShader(created, shader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX));
        gl.attachShader(created, shader(gl.FRAGMENT_SHADER, fragment));
        gl.bindAttribLocation(created, 0, 'aCorner');
        gl.linkProgram(created);
        return { program: created, uniforms: new Map() };
    }

    function build(): void {
        parallel = gl.getExtension('KHR_parallel_shader_compile');
        field = program(FIELD_FRAGMENT);
        contour = program(CONTOUR_FRAGMENT);
        corners = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        target = null;
        texture = null;
        linked = false;
    }

    function finishLink(): boolean {
        const all = [field, contour];
        if (parallel && !all.every(({ program: p }) => gl.getProgramParameter(p, parallel?.COMPLETION_STATUS_KHR ?? 0)))
            return false;
        for (const { program: p } of all) {
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Stage shaders did not link');
        }
        for (const name of FIELD_UNIFORMS) field.uniforms.set(name, gl.getUniformLocation(field.program, name));
        for (const name of CONTOUR_UNIFORMS) contour.uniforms.set(name, gl.getUniformLocation(contour.program, name));
        linked = true;
        return true;
    }

    /** Half floats keep the isobars smooth; plain bytes still work, with slightly stepped lines. */
    function allocate(w: number, h: number): void {
        if (webgl2 && gl.getExtension('EXT_color_buffer_float')) {
            const gl2 = gl as WebGL2RenderingContext;
            gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, w, h, 0, gl2.RGBA, gl2.HALF_FLOAT, null);
            return;
        }
        const half = !webgl2 ? gl.getExtension('OES_texture_half_float') : null;
        if (half && gl.getExtension('OES_texture_half_float_linear')) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, half.HALF_FLOAT_OES, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (complete) return;
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
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function drawField(frame: WeatherFrame): void {
        const u = (name: string) => field.uniforms.get(name) ?? null;
        const plates = plateUniform(frame.plates);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, size.cells[0], size.cells[1]);
        gl.useProgram(field.program);
        gl.uniform2f(u('uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u('uCell'), size.cell);
        gl.uniform1f(u('uTime'), frame.time);
        gl.uniform1f(u('uSeed'), frame.seed);
        gl.uniform1f(u('uWarp'), frame.warp);
        gl.uniform1f(u('uDrift'), frame.drift);
        gl.uniform1f(u('uScroll'), frame.scroll);
        gl.uniform3fv(u('uLight'), frame.light);
        gl.uniform4fv(u('uPlates'), plates.data);
        gl.uniform1f(u('uPlateCount'), plates.count);
        fullscreen();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function drawContours(frame: WeatherFrame): void {
        const u = (name: string) => contour.uniforms.get(name) ?? null;
        gl.viewport(0, 0, size.width, size.height);
        gl.useProgram(contour.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(u('uField'), 0);
        gl.uniform2f(u('uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u('uCell'), size.cell);
        gl.uniform2f(u('uRes'), size.width, size.height);
        gl.uniform1f(u('uScale'), size.scale);
        gl.uniform1f(u('uBands'), frame.bands);
        gl.uniform1f(u('uGlow'), frame.glow);
        gl.uniform1f(u('uIntro'), frame.intro);
        gl.uniform3fv(u('uPulse'), frame.pulse);
        gl.uniform3fv(u('uLight'), frame.light);
        gl.uniform3fv(u('uVoid'), palette.void);
        gl.uniform3fv(u('uSmoke'), palette.smoke);
        gl.uniform3fv(u('uLine'), palette.line);
        gl.uniform3fv(u('uIndex'), palette.index);
        gl.uniform3fv(u('uBtc'), palette.btc);
        fullscreen();
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
        draw(frame) {
            if (!linked || gl.isContextLost()) return;
            drawField(frame);
            drawContours(frame);
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
