import { TOKENS } from '../styles/tokens.ts';
import { type Points, STAGGER, STRIDE } from './morph.ts';
import { MAX_POINTS } from './scenes/types.ts';
import { FIELD_FRAGMENT, FULLSCREEN_VERTEX, HALFTONE_FRAGMENT, POINTS_FRAGMENT, POINTS_VERTEX } from './shaders.ts';
import { isSoftwareRenderer } from './tier.ts';

export class SoftwareRendererError extends Error {
    override name = 'SoftwareRendererError';
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;
type Vec3 = readonly [number, number, number];
type Vec4 = readonly [number, number, number, number];

export interface WeatherFrame {
    time: number;
    seed: number;
    warp: number;
    drift: number;
    density: number;
    contrast: number;
    warmth: number;
    scroll: number;
    intro: number;
    pulse: Vec3;
    light: Vec3;
    calm: Vec4;
}

export interface PointsFrame {
    plot: Vec4;
    morph: number;
    scatter: number;
    alpha: number;
}

export interface Surface {
    /** Canvas size in device pixels. */
    width: number;
    height: number;
    /** Front halftone cell, in device pixels: a whole number so every dot sits on the pixel grid. */
    cellDev: number;
    /** Field texture size: one texel per cell. */
    cells: [number, number];
}

export interface Renderer {
    readonly ready: boolean;
    resize(cssWidth: number, cssHeight: number, scale: number): Surface;
    upload(points: Points): void;
    draw(weather: WeatherFrame, points: PointsFrame | null): void;
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

const FIELD_UNIFORMS = ['uCells', 'uCell', 'uTime', 'uSeed', 'uWarp', 'uDrift', 'uScroll'] as const;
const HALFTONE_UNIFORMS = [
    'uField',
    'uCells',
    'uCellDev',
    'uRes',
    'uScale',
    'uDensity',
    'uContrast',
    'uWarmth',
    'uIntro',
    'uPulse',
    'uLight',
    'uCalm',
    'uInk',
    'uDot',
    'uFiat',
    'uBtc',
] as const;
const POINT_UNIFORMS = ['uView', 'uPlot', 'uScale', 'uMorph', 'uScatter', 'uAlpha', 'uStagger'] as const;
const POINT_ATTRIBUTES = [
    ['aPath', 4, 0],
    ['aRadius', 2, 4],
    ['aFrom', 4, 6],
    ['aTo', 4, 10],
    ['aSeed', 3, 14],
] as const;

export function hexRgb(hex: string): Vec3 {
    const value = Number.parseInt(hex.slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Front cell in CSS pixels: finer on a phone, where the field is seen up close. */
export function cellCss(cssWidth: number): number {
    return cssWidth < 640 ? 8 : 10;
}

export function surfaceFor(cssWidth: number, cssHeight: number, scale: number): Surface {
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));
    const cellDev = Math.max(3, Math.round(cellCss(cssWidth) * scale));
    return { width, height, cellDev, cells: [Math.ceil(width / cellDev) + 1, Math.ceil(height / cellDev) + 1] };
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

    let parallel = gl.getExtension('KHR_parallel_shader_compile');
    let field: Program;
    let halftone: Program;
    let points: Program;
    let corners: WebGLBuffer | null = null;
    let pointBuffer: WebGLBuffer | null = null;
    let target: WebGLFramebuffer | null = null;
    let texture: WebGLTexture | null = null;
    let linked = false;
    let pointCount = 0;
    let size: Surface = surfaceFor(1, 1, 1);
    let css = { width: 1, height: 1, scale: 1 };
    const ink = hexRgb(TOKENS.ink);
    const dot = hexRgb(TOKENS.paper);
    const fiat = hexRgb(TOKENS.fiat);
    const btc = hexRgb(TOKENS.btc);

    function shader(type: number, source: string): WebGLShader {
        const created = gl.createShader(type);
        if (!created) throw new Error('Shader could not be created');
        gl.shaderSource(created, source);
        gl.compileShader(created);
        return created;
    }

    function program(vertex: string, fragment: string, first: string): Program {
        const created = gl.createProgram();
        if (!created) throw new Error('Program could not be created');
        gl.attachShader(created, shader(gl.VERTEX_SHADER, vertex));
        gl.attachShader(created, shader(gl.FRAGMENT_SHADER, fragment));
        gl.bindAttribLocation(created, 0, first);
        gl.linkProgram(created);
        return { program: created, uniforms: new Map() };
    }

    function build(): void {
        parallel = gl.getExtension('KHR_parallel_shader_compile');
        field = program(FULLSCREEN_VERTEX, FIELD_FRAGMENT, 'aCorner');
        halftone = program(FULLSCREEN_VERTEX, HALFTONE_FRAGMENT, 'aCorner');
        points = program(POINTS_VERTEX, POINTS_FRAGMENT, 'aPath');
        corners = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        pointBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, MAX_POINTS * STRIDE * 4, gl.DYNAMIC_DRAW);
        target = null;
        texture = null;
        linked = false;
        pointCount = 0;
    }

    function finishLink(): boolean {
        const all = [field, halftone, points];
        if (parallel && !all.every(({ program: p }) => gl.getProgramParameter(p, parallel?.COMPLETION_STATUS_KHR ?? 0)))
            return false;
        for (const { program: p } of all) {
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Stage shaders did not link');
        }
        for (const name of FIELD_UNIFORMS) field.uniforms.set(name, gl.getUniformLocation(field.program, name));
        for (const name of HALFTONE_UNIFORMS)
            halftone.uniforms.set(name, gl.getUniformLocation(halftone.program, name));
        for (const name of POINT_UNIFORMS) points.uniforms.set(name, gl.getUniformLocation(points.program, name));
        linked = true;
        return true;
    }

    function ensureTarget(): void {
        const [w, h] = size.cells;
        if (!texture) texture = gl.createTexture();
        if (!target) target = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, size.cells[0], size.cells[1]);
        gl.useProgram(field.program);
        gl.uniform2f(u('uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u('uCell'), size.cellDev / css.scale);
        gl.uniform1f(u('uTime'), frame.time);
        gl.uniform1f(u('uSeed'), frame.seed);
        gl.uniform1f(u('uWarp'), frame.warp);
        gl.uniform1f(u('uDrift'), frame.drift);
        gl.uniform1f(u('uScroll'), frame.scroll);
        fullscreen();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function drawHalftone(frame: WeatherFrame): void {
        const u = (name: string) => halftone.uniforms.get(name) ?? null;
        gl.viewport(0, 0, size.width, size.height);
        gl.useProgram(halftone.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(u('uField'), 0);
        gl.uniform2f(u('uCells'), size.cells[0], size.cells[1]);
        gl.uniform1f(u('uCellDev'), size.cellDev);
        gl.uniform2f(u('uRes'), size.width, size.height);
        gl.uniform1f(u('uScale'), css.scale);
        gl.uniform1f(u('uDensity'), frame.density);
        gl.uniform1f(u('uContrast'), frame.contrast);
        gl.uniform1f(u('uWarmth'), frame.warmth);
        gl.uniform1f(u('uIntro'), frame.intro);
        gl.uniform3fv(u('uPulse'), frame.pulse);
        gl.uniform3fv(u('uLight'), frame.light);
        gl.uniform4fv(u('uCalm'), frame.calm);
        gl.uniform3fv(u('uInk'), ink);
        gl.uniform3fv(u('uDot'), dot);
        gl.uniform3fv(u('uFiat'), fiat);
        gl.uniform3fv(u('uBtc'), btc);
        fullscreen();
    }

    function drawPoints(frame: PointsFrame): void {
        if (pointCount === 0 || frame.alpha <= 0) return;
        const u = (name: string) => points.uniforms.get(name) ?? null;
        gl.useProgram(points.program);
        gl.uniform2f(u('uView'), css.width, css.height);
        gl.uniform4fv(u('uPlot'), frame.plot);
        gl.uniform1f(u('uScale'), css.scale);
        gl.uniform1f(u('uMorph'), frame.morph);
        gl.uniform1f(u('uScatter'), frame.scatter);
        gl.uniform1f(u('uAlpha'), frame.alpha);
        gl.uniform1f(u('uStagger'), STAGGER);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        const locations = POINT_ATTRIBUTES.map(([name, components, offset]) => {
            const location = gl.getAttribLocation(points.program, name);
            if (location < 0) return location;
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, components, gl.FLOAT, false, STRIDE * 4, offset * 4);
            return location;
        });
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, pointCount);
        gl.disable(gl.BLEND);
        for (const location of locations) if (location > 0) gl.disableVertexAttribArray(location);
    }

    build();

    return {
        get ready() {
            return linked || finishLink();
        },
        resize(cssWidth, cssHeight, scale) {
            css = { width: cssWidth, height: cssHeight, scale };
            size = surfaceFor(cssWidth, cssHeight, scale);
            canvas.width = size.width;
            canvas.height = size.height;
            ensureTarget();
            return size;
        },
        upload(state) {
            gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.data.subarray(0, state.count * STRIDE));
            pointCount = state.count;
        },
        draw(frame, pointFrame) {
            if (!linked || gl.isContextLost()) return;
            drawField(frame);
            drawHalftone(frame);
            if (pointFrame) drawPoints(pointFrame);
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
