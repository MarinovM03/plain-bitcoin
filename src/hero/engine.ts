import { createLadder, type Ladder, type Quality, settingsFor } from './degrade.ts';
import { createRenderer, type Renderer, SoftwareRendererError, type WeatherFrame } from './gl.ts';
import { inkRgba } from './inks.ts';
import { type FrameMode, frameInterval, frameMode, stepSeconds } from './loop.ts';
import { createPoints, MORPH_SECONDS, morphFor, retarget } from './morph.ts';
import type { Layout } from './scenes/types.ts';
import { type ChainState, chainWeather, type Weather } from './weather.ts';

const INTRO_SECONDS = 1.6;
const PULSE_SECONDS = 3.4;
const SETTLE_SECONDS = 2.5;
const LIGHT_SECONDS = 1.2;
const ALPHA_SECONDS = 0.35;
const REBUILD_SCATTER = 0.3;
const TWEAK_SCATTER = 0.06;
const REPORT_MS = 1000;
const NOWHERE = [-1e5, -1e5, 0, 0] as const;

export type Rect = [number, number, number, number];
export type StageTier = 'full' | 'phone';

export interface View {
    width: number;
    height: number;
    pixelRatio: number;
}

export type EngineCanvas = HTMLCanvasElement | OffscreenCanvas;

export type EngineMessage =
    | {
          type: 'init';
          canvas: EngineCanvas;
          allowSoftware: boolean;
          tier: StageTier;
          pinned: boolean;
          reduced: boolean;
          view: View;
      }
    | { type: 'view'; view: View }
    | { type: 'scene'; layout: Layout | null; rev: number; fresh: boolean; snap: boolean; rect: Rect; calm: Rect }
    | { type: 'rect'; rect: Rect; calm: Rect }
    | { type: 'scroll'; y: number; away: boolean }
    | { type: 'chain'; chain: ChainState | null; pulse: [number, number] | null }
    | { type: 'pointer'; x: number; y: number }
    | { type: 'visible'; visible: boolean }
    | { type: 'reduced'; reduced: boolean }
    | { type: 'lose' };

export type EngineReply =
    | { type: 'drawn'; frames: number; live: boolean; settled: number | null; fps: number; mode: FrameMode }
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

type Mood = Pick<Weather, 'density' | 'warp' | 'contrast' | 'drift' | 'warmth'>;
const MOOD_KEYS = ['density', 'warp', 'contrast', 'drift', 'warmth'] as const;

export function createEngine(reply: (message: EngineReply) => void): (message: EngineMessage) => void {
    const colors = inkRgba();
    const points = createPoints();
    let renderer: Renderer | null = null;
    let canvas: EngineCanvas | null = null;
    let tier: StageTier = 'full';
    let pinned = false;
    let ladder: Ladder = createLadder('full');
    let quality: Quality = 'full';
    let reduced = false;
    let visible = true;
    let lost = false;
    let view: View = { width: 1, height: 1, pixelRatio: 1 };

    let frames = 0;
    let reported = { frames: -1, live: false, settled: null as number | null, at: 0 };
    let raf = 0;
    let timer = 0;
    let requestedAt = 0;
    let lastDraw = 0;
    let dirty = true;
    let windowStart = 0;
    let windowFrames = 0;
    let fps = 0;
    let lastMode: FrameMode = 'sleep';

    let chain: ChainState | null = null;
    let chained = false;
    let time = 0;
    let intro = 0;
    let seed = 0;
    let seedFrom = 0;
    let seedTo = 0;
    let mood: Mood | null = null;
    let pulse = -1;
    let origin: [number, number] = [0, 0];
    const light = { x: 0, y: 0, i: 0 };
    let scrollY = 0;
    let away = false;
    let alpha = 1;
    let alphaTarget = 1;

    let layout: Layout | null = null;
    let rev: number | null = null;
    let morph = 1;
    let scatter = 0;
    let hasPoints = false;
    let docRect: Rect = [...NOWHERE];
    let calmRect: Rect = [...NOWHERE];

    const settings = () => settingsFor(quality, tier);
    const calm = () => reduced || quality === 'still';

    function target(): Weather {
        return chainWeather(chain, Date.now());
    }

    function settleAll(): void {
        intro = INTRO_SECONDS;
        morph = 1;
        pulse = -1;
        seed = seedTo;
        mood = pick(target());
        light.i = 0;
        alpha = alphaTarget;
    }

    function pick(weather: Weather): Mood {
        return {
            density: weather.density,
            warp: weather.warp,
            contrast: weather.contrast,
            drift: weather.drift,
            warmth: weather.warmth,
        };
    }

    function moodMoving(goal: Mood): boolean {
        return mood !== null && MOOD_KEYS.some((key) => Math.abs((mood?.[key] ?? 0) - goal[key]) > 0.004);
    }

    function animating(): boolean {
        if (calm()) return false;
        return (
            intro < INTRO_SECONDS ||
            morph < 1 ||
            pulse >= 0 ||
            light.i > 0.01 ||
            Math.abs(alpha - alphaTarget) > 0.001 ||
            moodMoving(pick(target()))
        );
    }

    function loopState() {
        return { visible, reduced, quality, dirty, animating: animating(), lost: lost || !renderer };
    }

    function cancel(): void {
        cancelFrame(raf);
        clearTimeout(timer);
        raf = 0;
        timer = 0;
    }

    function schedule(): void {
        if (raf || timer) return;
        const mode = frameMode(loopState(), settings());
        if (mode === 'sleep') {
            lastDraw = 0;
            report(true);
            return;
        }
        requestedAt = performance.now();
        const wait = lastDraw > 0 ? lastDraw + frameInterval(mode, settings()) - requestedAt - 4 : 0;
        if (wait > 12) {
            timer = setTimeout(() => {
                timer = 0;
                raf = nextFrame(tick);
            }, wait) as unknown as number;
        } else {
            raf = nextFrame(tick);
        }
    }

    function invalidate(): void {
        dirty = true;
        schedule();
    }

    function onScreen(rect: Rect): Rect {
        return [rect[0], rect[1] - scrollY, rect[2], rect[3]];
    }

    function plotRect(): Rect {
        return onScreen(docRect);
    }

    function resize(): void {
        if (!renderer) return;
        const scale = Math.min(view.pixelRatio || 1, settings().dprCap);
        renderer.resize(view.width, view.height, scale);
        invalidate();
    }

    function advance(dt: number): void {
        const goal = pick(target());
        if (calm()) {
            settleAll();
            return;
        }
        time += dt;
        intro = Math.min(INTRO_SECONDS, intro + dt);
        morph = Math.min(1, morph + dt / MORPH_SECONDS);
        if (pulse >= 0) {
            pulse += dt / PULSE_SECONDS;
            seed = seedFrom + (seedTo - seedFrom) * smooth(pulse);
            if (pulse >= 1) {
                pulse = -1;
                seed = seedTo;
            }
        }
        const k = 1 - Math.exp(-dt / (SETTLE_SECONDS / 3));
        const current: Mood = mood ?? goal;
        mood = {
            density: current.density + (goal.density - current.density) * k,
            warp: current.warp + (goal.warp - current.warp) * k,
            contrast: current.contrast + (goal.contrast - current.contrast) * k,
            drift: current.drift + (goal.drift - current.drift) * k,
            warmth: current.warmth + (goal.warmth - current.warmth) * k,
        };
        light.i = Math.max(0, light.i - dt / LIGHT_SECONDS);
        const step = dt / ALPHA_SECONDS;
        alpha = alpha < alphaTarget ? Math.min(alphaTarget, alpha + step) : Math.max(alphaTarget, alpha - step);
    }

    function weatherFrame(): WeatherFrame {
        const now = mood ?? pick(target());
        const shown = hasPoints && !(away && alpha <= 0);
        return {
            time: calm() ? 0 : time,
            seed,
            warp: now.warp,
            drift: now.drift,
            density: now.density,
            contrast: now.contrast,
            warmth: now.warmth,
            scroll: scrollY,
            intro: smooth(intro / INTRO_SECONDS),
            pulse: [origin[0], origin[1], pulse],
            light: [light.x, light.y, light.i],
            calm: shown ? onScreen(calmRect) : NOWHERE,
        };
    }

    function draw(): void {
        if (!renderer) return;
        renderer.draw(weatherFrame(), hasPoints ? { plot: plotRect(), morph, scatter, alpha } : null);
        frames += 1;
    }

    function settledRev(): number | null {
        if (!hasPoints || rev === null || away) return null;
        return morph >= 1 ? rev : null;
    }

    function report(force = false): void {
        const live = hasPoints && !away;
        const settled = settledRev();
        const now = performance.now();
        const changed = live !== reported.live || settled !== reported.settled;
        const due = frames !== reported.frames && (force || now - reported.at >= REPORT_MS);
        if (!changed && !due) return;
        reported = { frames, live, settled, at: now };
        reply({ type: 'drawn', frames, live, settled, fps, mode: lastMode });
    }

    function teardown(): void {
        cancel();
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

    function measure(now: number, mode: FrameMode, interval: number): void {
        if (!windowStart) windowStart = now;
        windowFrames += 1;
        if (now - windowStart >= 1000) {
            fps = Math.round((windowFrames * 1000) / (now - windowStart));
            windowStart = now;
            windowFrames = 0;
        }
        if (pinned) return;
        const next =
            mode === 'once'
                ? ladder.still(now - requestedAt)
                : interval > 0
                  ? ladder.sample(interval, frameInterval(mode, settings()))
                  : null;
        if (next) applyQuality(next);
    }

    function tick(now: number): void {
        raf = 0;
        if (lost || !visible || !renderer) return;
        if (!renderer.ready) {
            raf = nextFrame(tick);
            return;
        }
        const mode = frameMode(loopState(), settings());
        // Never faster than asked: an early vsync waits for the next one.
        if (lastDraw > 0 && mode !== 'once' && now - lastDraw < frameInterval(mode, settings()) * 0.92) {
            raf = nextFrame(tick);
            return;
        }
        lastMode = mode;
        const interval = lastDraw > 0 ? now - lastDraw : 0;
        advance(stepSeconds(lastDraw, now));
        dirty = false;
        draw();
        lastDraw = mode === 'once' ? 0 : now;
        measure(now, mode, mode === 'once' ? 0 : interval);
        report();
        if (renderer) schedule();
    }

    function onLost(event: Event): void {
        event.preventDefault();
        lost = true;
        cancel();
    }

    function onRestored(): void {
        lost = false;
        renderer?.restore();
        resize();
        renderer?.upload(points);
        lastDraw = 0;
        invalidate();
    }

    function init(message: Extract<EngineMessage, { type: 'init' }>): void {
        canvas = message.canvas;
        try {
            renderer = createRenderer(canvas, message.allowSoftware);
        } catch (error) {
            reply({ type: 'failed', software: error instanceof SoftwareRendererError });
            return;
        }
        tier = message.tier;
        pinned = message.pinned;
        quality = 'full';
        ladder = createLadder('full');
        reduced = message.reduced;
        view = message.view;
        canvas.addEventListener('webglcontextlost', onLost as EventListener);
        canvas.addEventListener('webglcontextrestored', onRestored);
        if (reduced) settleAll();
        reply({ type: 'quality', quality });
        resize();
    }

    function setScene(message: Extract<EngineMessage, { type: 'scene' }>): void {
        const next = message.layout;
        const kind = morphFor(layout, next, message.fresh);
        retarget(points, next, morph, scatter, colors, kind);
        renderer?.upload(points);
        scatter = kind.kind === 'tweak' ? TWEAK_SCATTER : kind.kind === 'rebuild' ? REBUILD_SCATTER : 0;
        morph = calm() || message.snap ? 1 : 0;
        layout = next;
        rev = next ? message.rev : null;
        hasPoints = (next?.count ?? 0) > 0;
        docRect = message.rect;
        calmRect = message.calm;
        invalidate();
        report();
    }

    function setChain(message: Extract<EngineMessage, { type: 'chain' }>): void {
        chain = message.chain;
        const next = target();
        if (message.pulse && chained && !calm()) {
            seedFrom = seed;
            seedTo = next.seed;
            pulse = 0;
            origin = message.pulse;
        } else if (pulse < 0) {
            seed = next.seed;
            seedFrom = next.seed;
            seedTo = next.seed;
        } else {
            seedTo = next.seed;
        }
        if (!chained || calm()) mood = pick(next);
        chained = true;
        invalidate();
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
            case 'scene':
                setScene(message);
                return;
            case 'rect':
                docRect = message.rect;
                calmRect = message.calm;
                invalidate();
                return;
            case 'scroll':
                scrollY = message.y;
                if (message.away !== away) {
                    away = message.away;
                    alphaTarget = away ? 0 : 1;
                    if (!chained || calm()) alpha = alphaTarget;
                    report();
                }
                invalidate();
                return;
            case 'chain':
                setChain(message);
                return;
            case 'pointer':
                if (calm()) return;
                light.x = message.x;
                light.y = message.y;
                light.i = 1;
                schedule();
                return;
            case 'visible':
                visible = message.visible;
                if (!visible) {
                    cancel();
                    lastDraw = 0;
                    ladder.reset();
                    report(true);
                } else {
                    invalidate();
                }
                return;
            case 'reduced':
                reduced = message.reduced;
                if (reduced) settleAll();
                invalidate();
                return;
            case 'lose':
                renderer?.simulateLoss();
                return;
        }
    };
}
