import { createLadder, type Ladder, type Quality, settingsFor } from './degrade.ts';
import { createRenderer, type Rect, type Renderer, SoftwareRendererError, type WeatherFrame } from './gl.ts';
import { easeToward, type FrameMode, frameInterval, frameMode, moodSettling, stepSeconds } from './loop.ts';
import { type ChainState, chainWeather, type Weather } from './weather.ts';

const INTRO_SECONDS = 1.4;
export const PULSE_SECONDS = 3.4;
const LIGHT_SECONDS = 1.4;
const REPORT_MS = 1000;

export type { Rect } from './gl.ts';
export type StageTier = 'full' | 'phone';

export interface View {
    width: number;
    height: number;
    pixelRatio: number;
}

export type EngineCanvas = HTMLCanvasElement | OffscreenCanvas;

/** A forced-tier test override: pins the minutes since the block, so a test can see the body at a set tension. */
export interface WeatherMock {
    minutes: number | null;
}

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
    | { type: 'plates'; plates: Rect[] }
    | { type: 'scroll'; y: number }
    | { type: 'chain'; chain: ChainState | null; pulse: [number, number] | null }
    | { type: 'pointer'; x: number; y: number }
    | { type: 'visible'; visible: boolean }
    | { type: 'reduced'; reduced: boolean }
    | { type: 'mock'; mock: WeatherMock; pulse: [number, number] | null }
    | { type: 'lose' };

export type EngineReply =
    | { type: 'drawn'; frames: number; fps: number; mode: FrameMode; pulsing: boolean; width: number; height: number }
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

type Mood = Pick<Weather, 'tension' | 'bands' | 'warp' | 'drift' | 'glow'>;
const MOOD_KEYS = ['tension', 'bands', 'warp', 'drift', 'glow'] as const;

function pick(weather: Weather): Mood {
    return {
        tension: weather.tension,
        bands: weather.bands,
        warp: weather.warp,
        drift: weather.drift,
        glow: weather.glow,
    };
}

export function createEngine(reply: (message: EngineReply) => void): (message: EngineMessage) => void {
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
    let surface = { width: 0, height: 0 };

    let frames = 0;
    let reported = { frames: -1, pulsing: false, at: 0 };
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
    let mock: WeatherMock = { minutes: null };
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
    let plates: Rect[] = [];

    const settings = () => settingsFor(quality, tier);
    const calm = () => reduced || quality === 'still';

    function target(): Weather {
        const now = Date.now();
        if (mock.minutes === null) return chainWeather(chain, now);
        return chainWeather(
            { height: chain?.height ?? 0, blockTime: now - mock.minutes * 60_000, estimated: false },
            now,
        );
    }

    function settleAll(): void {
        intro = INTRO_SECONDS;
        pulse = -1;
        seed = seedTo;
        mood = pick(target());
        light.i = 0;
    }

    function animating(): boolean {
        if (calm()) return false;
        return (
            intro < INTRO_SECONDS ||
            pulse >= 0 ||
            light.i > 0.01 ||
            (mood !== null && moodSettling(mood.tension, target().tension))
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

    function resize(): void {
        if (!renderer) return;
        const { dprCap, renderScale } = settings();
        const scale = Math.min(view.pixelRatio || 1, dprCap) * renderScale;
        surface = renderer.resize(view.width, view.height, scale);
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
        if (pulse >= 0) {
            pulse += dt / PULSE_SECONDS;
            seed = seedFrom + (seedTo - seedFrom) * smooth(pulse);
            if (pulse >= 1) {
                pulse = -1;
                seed = seedTo;
            }
        }
        const current: Mood = mood ?? goal;
        const eased = { ...goal };
        for (const key of MOOD_KEYS) eased[key] = easeToward(current[key], goal[key], dt);
        mood = eased;
        light.i = Math.max(0, light.i - dt / LIGHT_SECONDS);
    }

    function weatherFrame(): WeatherFrame {
        const now = mood ?? pick(target());
        return {
            time,
            seed,
            warp: now.warp,
            drift: now.drift,
            bands: now.bands,
            glow: now.glow,
            scroll: scrollY,
            intro: calm() ? 1 : smooth(intro / INTRO_SECONDS),
            pulse: [origin[0], origin[1], pulse],
            light: [light.x, light.y, light.i],
            plates,
        };
    }

    function draw(): void {
        if (!renderer) return;
        renderer.draw(weatherFrame());
        frames += 1;
    }

    function report(force = false): void {
        const now = performance.now();
        const pulsing = pulse >= 0;
        const due = frames !== reported.frames && (force || now - reported.at >= REPORT_MS);
        if (pulsing === reported.pulsing && !due) return;
        reported = { frames, pulsing, at: now };
        reply({ type: 'drawn', frames, fps, mode: lastMode, pulsing, ...surface });
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

    function startPulse(at: [number, number]): void {
        seedFrom = seed;
        seedTo = target().seed;
        pulse = 0;
        origin = at;
    }

    function setChain(message: Extract<EngineMessage, { type: 'chain' }>): void {
        chain = message.chain;
        const next = target();
        if (message.pulse && chained && !calm()) {
            startPulse(message.pulse);
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
            case 'plates':
                plates = message.plates;
                invalidate();
                return;
            case 'scroll':
                scrollY = message.y;
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
            case 'mock':
                mock = message.mock;
                if (calm()) mood = pick(target());
                if (message.pulse && !calm()) startPulse(message.pulse);
                invalidate();
                return;
            case 'lose':
                renderer?.simulateLoss();
                return;
        }
    };
}
