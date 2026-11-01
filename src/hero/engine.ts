import { createFrameMonitor, type Quality } from './degrade.ts';
import { createRenderer, type Renderer, SoftwareRendererError } from './gl.ts';
import { inkRgba } from './inks.ts';
import { createPoints, MORPH_SECONDS, retarget } from './morph.ts';
import type { Layout } from './scenes/types.ts';
import type { Weather } from './weather.ts';

const FPS = 30;
const INTRO_SECONDS = 4;
const FADE_SECONDS = 1.2;
const PULSE_SECONDS = 3.4;
const TENSION_SECONDS = 2.5;
const LIGHT_SECONDS = 1.2;
const ALPHA_SECONDS = 0.35;
const DPR_CAP = 1.5;
const REBUILD_SCATTER = 0.3;
const TWEAK_SCATTER = 0.06;
const NOWHERE = [-1e5, -1e5, 0, 0] as const;
const REPORT_EVERY = FPS;

export type Rect = [number, number, number, number];

export interface View {
    width: number;
    height: number;
    pixelRatio: number;
}

export type EngineCanvas = HTMLCanvasElement | OffscreenCanvas;

export type EngineMessage =
    | { type: 'init'; canvas: EngineCanvas; allowSoftware: boolean; quality: Quality; reduced: boolean; view: View }
    | { type: 'view'; view: View }
    | { type: 'scene'; layout: Layout | null; rebuild: boolean; snap: boolean; rect: Rect }
    | { type: 'rect'; rect: Rect }
    | { type: 'scroll'; y: number; away: boolean }
    | { type: 'chain'; weather: Weather; pulse: [number, number] | null }
    | { type: 'pointer'; x: number; y: number }
    | { type: 'visible'; visible: boolean }
    | { type: 'reduced'; reduced: boolean };

export type EngineReply =
    | { type: 'drawn'; frames: number; live: boolean }
    | { type: 'quality'; quality: Quality }
    | { type: 'failed'; software: boolean };

// Workers get requestAnimationFrame only alongside OffscreenCanvas, and not in every engine.
const nextFrame: (callback: (now: number) => void) => number =
    typeof requestAnimationFrame === 'function'
        ? (callback) => requestAnimationFrame(callback)
        : (callback) => setTimeout(() => callback(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void =
    typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

function smooth(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
}

export function createEngine(reply: (message: EngineReply) => void): (message: EngineMessage) => void {
    const colors = inkRgba();
    const points = createPoints();
    let renderer: Renderer | null = null;
    let canvas: EngineCanvas | null = null;
    let monitor = createFrameMonitor('full');
    let quality: Quality = 'full';
    let reduced = false;
    let visible = true;
    let view: View = { width: 1, height: 1, pixelRatio: 1 };
    let frames = 0;
    let reported = { frames: 0, live: false };
    let raf = 0;
    let requestedAt = 0;
    let lastDraw = 0;
    let lost = false;
    let dirty = true;
    let flow = 0;
    let intro = 0;
    let fade = 0;
    let seed = 0;
    let seedFrom = 0;
    let seedTo = 0;
    let tension = 0;
    let tensionFrom = 0;
    let tensionTo = 0;
    let tensionT = 1;
    let chained = false;
    let pulse = -1;
    let origin: [number, number] = [0, 0];
    const light = { x: 0, y: 0, i: 0 };
    let alpha = 1;
    let alphaTarget = 1;
    let away = false;
    let scrollY = 0;
    let morph = 1;
    let scatter = 0;
    let hasPoints = false;
    let docRect: Rect = [...NOWHERE];

    const calm = () => reduced || quality === 'still';

    function settleAll(): void {
        intro = INTRO_SECONDS;
        fade = 1;
        morph = 1;
        pulse = -1;
        seed = seedTo;
        tension = tensionTo;
        tensionT = 1;
        light.i = 0;
        alpha = alphaTarget;
    }

    function busy(): boolean {
        if (dirty) return true;
        if (calm()) return false;
        return (
            intro < INTRO_SECONDS ||
            fade < 1 ||
            morph < 1 ||
            pulse >= 0 ||
            tensionT < 1 ||
            light.i > 0.01 ||
            Math.abs(alpha - alphaTarget) > 0.001
        );
    }

    function request(): void {
        if (raf || lost || !visible || !renderer || quality === 'plain') return;
        requestedAt = performance.now();
        raf = nextFrame(tick);
    }

    function invalidate(): void {
        dirty = true;
        request();
    }

    function plotRect(): Rect {
        return [docRect[0], docRect[1] - scrollY, docRect[2], docRect[3]];
    }

    function resize(): void {
        if (!renderer) return;
        const scale = Math.min(view.pixelRatio || 1, DPR_CAP);
        renderer.resize(view.width, view.height, scale, quality === 'full' ? 1 : 0.5);
        invalidate();
    }

    function advance(dt: number): void {
        if (calm()) {
            settleAll();
            return;
        }
        flow += dt * (0.45 + tension);
        intro = Math.min(INTRO_SECONDS, intro + dt);
        fade = Math.min(1, fade + dt / FADE_SECONDS);
        morph = Math.min(1, morph + dt / MORPH_SECONDS);
        if (pulse >= 0) {
            pulse += dt / PULSE_SECONDS;
            seed = seedFrom + (seedTo - seedFrom) * smooth(pulse);
            if (pulse >= 1) {
                pulse = -1;
                seed = seedTo;
            }
        }
        if (tensionT < 1) {
            tensionT = Math.min(1, tensionT + dt / TENSION_SECONDS);
            tension = tensionFrom + (tensionTo - tensionFrom) * smooth(tensionT);
        }
        light.i = Math.max(0, light.i - dt / LIGHT_SECONDS);
        const step = dt / ALPHA_SECONDS;
        alpha = alpha < alphaTarget ? Math.min(alphaTarget, alpha + step) : Math.max(alphaTarget, alpha - step);
    }

    function draw(): void {
        if (!renderer) return;
        const rect = plotRect();
        renderer.draw(
            {
                flow,
                seed,
                tension,
                intro: smooth(fade) * (0.55 + 0.45 * smooth(intro / 2)),
                pulse: [origin[0], origin[1], pulse],
                light: [light.x, light.y, light.i],
                calm: hasPoints && !(away && alpha <= 0) ? rect : NOWHERE,
            },
            hasPoints ? { plot: rect, morph, scatter, alpha } : null,
        );
        frames += 1;
        const live = hasPoints && !away;
        if (frames === 1 || live !== reported.live || frames - reported.frames >= REPORT_EVERY) report(live);
    }

    function report(live: boolean): void {
        if (reported.frames === frames && reported.live === live) return;
        reported = { frames, live };
        reply({ type: 'drawn', frames, live });
    }

    function teardown(): void {
        cancelFrame(raf);
        raf = 0;
        renderer?.dispose();
        renderer = null;
    }

    function applyQuality(next: Quality): void {
        quality = next;
        reply({ type: 'quality', quality: next });
        if (next === 'plain') {
            teardown();
            return;
        }
        if (next === 'still') settleAll();
        resize();
    }

    function sample(value: number): boolean {
        const next = monitor.sample(value);
        if (!next) return false;
        applyQuality(next);
        return true;
    }

    function tick(now: number): void {
        raf = 0;
        if (lost || !visible || !renderer) return;
        if (!renderer.ready) {
            request();
            return;
        }
        if (!calm() && lastDraw && now - lastDraw < 1000 / FPS - 4) {
            raf = nextFrame(tick);
            return;
        }
        const frameMs = lastDraw ? now - lastDraw : 0;
        const latency = now - requestedAt;
        lastDraw = now;
        dirty = false;
        advance(frameMs ? Math.min(0.1, frameMs / 1000) : 0);
        draw();
        if (quality === 'still' && sample(latency)) return;
        if (quality !== 'still' && !reduced && frameMs > 0 && sample(frameMs)) return;
        if (busy()) request();
        else {
            lastDraw = 0;
            report(hasPoints && !away);
        }
    }

    function onLost(event: Event): void {
        event.preventDefault();
        lost = true;
        cancelFrame(raf);
        raf = 0;
    }

    function onRestored(): void {
        lost = false;
        renderer?.restore();
        resize();
        renderer?.upload(points);
    }

    function init(message: Extract<EngineMessage, { type: 'init' }>): void {
        canvas = message.canvas;
        try {
            renderer = createRenderer(canvas, message.allowSoftware);
        } catch (error) {
            reply({ type: 'failed', software: error instanceof SoftwareRendererError });
            return;
        }
        quality = message.quality;
        monitor = createFrameMonitor(quality);
        reduced = message.reduced;
        view = message.view;
        canvas.addEventListener('webglcontextlost', onLost as EventListener);
        canvas.addEventListener('webglcontextrestored', onRestored);
        if (reduced) settleAll();
        resize();
    }

    return (message) => {
        switch (message.type) {
            case 'init':
                init(message);
                return;
            case 'view':
                view = message.view;
                resize();
                return;
            case 'scene': {
                retarget(points, message.layout, morph, scatter, colors, message.rebuild);
                renderer?.upload(points);
                scatter = message.rebuild ? REBUILD_SCATTER : TWEAK_SCATTER;
                morph = calm() || message.snap ? 1 : 0;
                hasPoints = (message.layout?.count ?? 0) > 0 || points.count > 0;
                docRect = message.rect;
                invalidate();
                return;
            }
            case 'rect':
                docRect = message.rect;
                invalidate();
                return;
            case 'scroll':
                scrollY = message.y;
                if (message.away !== away) {
                    away = message.away;
                    alphaTarget = away ? 0 : 1;
                    if (!chained || calm()) alpha = alphaTarget;
                    invalidate();
                } else if (alpha > 0) {
                    invalidate();
                }
                return;
            case 'chain': {
                const next = message.weather;
                if (message.pulse && chained && !calm()) {
                    seedFrom = seed;
                    seedTo = next.seed;
                    pulse = 0;
                    origin = message.pulse;
                } else {
                    seed = next.seed;
                    seedFrom = next.seed;
                    seedTo = next.seed;
                }
                if (!chained || calm()) {
                    tension = next.tension;
                    tensionTo = next.tension;
                } else if (Math.abs(next.tension - tensionTo) > 0.002) {
                    tensionFrom = tension;
                    tensionTo = next.tension;
                    tensionT = 0;
                }
                chained = true;
                invalidate();
                return;
            }
            case 'pointer':
                if (calm()) return;
                light.x = message.x;
                light.y = message.y;
                light.i = 1;
                request();
                return;
            case 'visible':
                visible = message.visible;
                if (!visible) {
                    cancelFrame(raf);
                    raf = 0;
                    lastDraw = 0;
                } else if (busy()) {
                    request();
                }
                return;
            case 'reduced':
                reduced = message.reduced;
                if (reduced) settleAll();
                invalidate();
                return;
        }
    };
}
