import { TOKENS } from '../styles/tokens.ts';
import { type Points, STRIDE } from './morph.ts';
import { MAX_POINTS } from './scenes/types.ts';
import { BLIT_FRAGMENT, FULLSCREEN_VERTEX, POINTS_FRAGMENT, POINTS_VERTEX, WEATHER_FRAGMENT } from './shaders.ts';
import { isSoftwareRenderer } from './tier.ts';

export class SoftwareRendererError extends Error {
    override name = 'SoftwareRendererError';
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;
type Vec3 = readonly [number, number, number];
type Vec4 = readonly [number, number, number, number];

export interface WeatherFrame {
    flow: number;
    seed: number;
    tension: number;
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

export interface Renderer {
    readonly ready: boolean;
    resize(width: number, height: number, scale: number, weatherScale: number): void;
    upload(points: Points): void;
    draw(weather: WeatherFrame, points: PointsFrame | null): void;
    restore(): void;
    dispose(): void;
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

const WEATHER_UNIFORMS = [
    'uView',
    'uScale',
    'uCell',
    'uFlow',
    'uSeed',
    'uTension',
    'uIntro',
    'uPulse',
    'uLight',
    'uCalm',
    'uInk',
    'uDot',
    'uFiat',
    'uBtc',
] as const;
const POINT_UNIFORMS = ['uView', 'uPlot', 'uScale', 'uMorph', 'uScatter', 'uAlpha'] as const;
const POINT_ATTRIBUTES = [
    ['aPath', 4, 0],
    ['aRadius', 2, 4],
    ['aFrom', 4, 6],
    ['aTo', 4, 10],
    ['aSeed', 1, 14],
    ['aWave', 1, 15],
] as const;

export function hexRgb(hex: string): Vec3 {
    const value = Number.parseInt(hex.slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

interface Program {
    program: WebGLProgram;
    uniforms: Map<string, WebGLUniformLocation | null>;
}

function cellSize(width: number): number {
    return width < 640 ? 8 : 10;
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
    let weather: Program;
    let blit: Program;
    let points: Program;
    let corners: WebGLBuffer | null = null;
    let pointBuffer: WebGLBuffer | null = null;
    let target: WebGLFramebuffer | null = null;
    let texture: WebGLTexture | null = null;
    let linked = false;
    let pointCount = 0;
    let view = { width: 1, height: 1, scale: 1, weatherScale: 1 };
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
        weather = program(FULLSCREEN_VERTEX, WEATHER_FRAGMENT, 'aCorner');
        blit = program(FULLSCREEN_VERTEX, BLIT_FRAGMENT, 'aCorner');
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
        const all = [weather, blit, points];
        if (parallel && !all.every(({ program: p }) => gl.getProgramParameter(p, parallel?.COMPLETION_STATUS_KHR ?? 0)))
            return false;
        for (const { program: p } of all) {
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Stage shaders did not link');
        }
        for (const name of WEATHER_UNIFORMS) weather.uniforms.set(name, gl.getUniformLocation(weather.program, name));
        for (const name of POINT_UNIFORMS) points.uniforms.set(name, gl.getUniformLocation(points.program, name));
        blit.uniforms.set('uTexture', gl.getUniformLocation(blit.program, 'uTexture'));
        linked = true;
        return true;
    }

    function ensureTarget(width: number, height: number): void {
        if (!texture) texture = gl.createTexture();
        if (!target) target = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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

    function drawWeather(frame: WeatherFrame, scale: number): void {
        const u = (name: string) => weather.uniforms.get(name) ?? null;
        gl.useProgram(weather.program);
        gl.uniform2f(u('uView'), view.width, view.height);
        gl.uniform1f(u('uScale'), scale);
        gl.uniform1f(u('uCell'), cellSize(view.width));
        gl.uniform1f(u('uFlow'), frame.flow);
        gl.uniform1f(u('uSeed'), frame.seed);
        gl.uniform1f(u('uTension'), frame.tension);
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
        gl.uniform2f(u('uView'), view.width, view.height);
        gl.uniform4fv(u('uPlot'), frame.plot);
        gl.uniform1f(u('uScale'), view.scale);
        gl.uniform1f(u('uMorph'), frame.morph);
        gl.uniform1f(u('uScatter'), frame.scatter);
        gl.uniform1f(u('uAlpha'), frame.alpha);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        const locations = POINT_ATTRIBUTES.map(([name, size, offset]) => {
            const location = gl.getAttribLocation(points.program, name);
            if (location < 0) return location;
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
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
        resize(width, height, scale, weatherScale) {
            view = { width, height, scale, weatherScale };
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            if (weatherScale < 1) {
                ensureTarget(
                    Math.max(1, Math.round(width * scale * weatherScale)),
                    Math.max(1, Math.round(height * scale * weatherScale)),
                );
            }
        },
        upload(state) {
            gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.data.subarray(0, state.count * STRIDE));
            pointCount = state.count;
        },
        draw(frame, pointFrame) {
            if (!linked || gl.isContextLost()) return;
            const reduced = view.weatherScale < 1 && target !== null;
            if (reduced) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, target);
                gl.viewport(
                    0,
                    0,
                    Math.round(view.width * view.scale * view.weatherScale),
                    Math.round(view.height * view.scale * view.weatherScale),
                );
                drawWeather(frame, view.scale * view.weatherScale);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.useProgram(blit.program);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(blit.uniforms.get('uTexture') ?? null, 0);
                fullscreen();
            } else {
                gl.viewport(0, 0, canvas.width, canvas.height);
                drawWeather(frame, view.scale);
            }
            if (pointFrame) drawPoints(pointFrame);
        },
        restore() {
            build();
            if (view.weatherScale < 1) {
                ensureTarget(
                    Math.max(1, Math.round(view.width * view.scale * view.weatherScale)),
                    Math.max(1, Math.round(view.height * view.scale * view.weatherScale)),
                );
            }
        },
        dispose() {
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}
