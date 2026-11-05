import type { ScenePayload } from '../gauges/types.ts';
import { type Camera, cameraFor, type Rect as PartRect, partRects, pickPart, projectPoint } from './camera.ts';
import { createLadder, type Ladder, type Quality, settingsFor } from './degrade.ts';
import { approach } from './gfx/math.ts';
import { createRenderer, type Rect, type Renderer, SoftwareRendererError, type WeatherFrame } from './gl.ts';
import { easeToward, type FrameMode, frameInterval, frameMode, moodSettling, stepSeconds } from './loop.ts';
import { dragOrbit, HOME, moving, type Orbit, releaseOrbit, stepOrbit, turned } from './orbit.ts';
import { type ClientRect, sceneViewport } from './pointer.ts';
import type { Frame, Scene, SceneFactory, SceneId } from './scenes/types.ts';
import { type ChainState, chainWeather, type Weather } from './weather.ts';

const INTRO_SECONDS = 1.4;
export const PULSE_SECONDS = 3.4;
const LIFT_SECONDS = 0.09;
const REPORT_MS = 1000;
/** CSS px a press may travel and still count as a tap rather than a turn. */
const TAP_SLOP = 6;

export type { Rect } from './gl.ts';
export type StageTier = 'full' | 'phone';

export interface View {
    width: number;
    height: number;
    pixelRatio: number;
}

export type EngineCanvas = HTMLCanvasElement | OffscreenCanvas;

/** A forced-tier test override: pins the minutes since the block, so a test can see the weather at a set tension. */
export interface WeatherMock {
    minutes: number | null;
}

export type PointerKind = 'move' | 'down' | 'up' | 'leave' | 'cancel';

export interface PointerMessage {
    type: 'pointer';
    kind: PointerKind;
    cssX: number;
    cssY: number;
    ndcX: number;
    ndcY: number;
    inside: boolean;
    /** A mouse may also tilt; touch and pen only turn sideways, leaving vertical swipes to the page. */
    mouse: boolean;
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
    /** Viewport CSS px, measured together in one frame: the canvas, every plate, and the scene window. */
    | { type: 'layout'; canvas: ClientRect; plates: Rect[]; window: ClientRect | null }
    | { type: 'chain'; chain: ChainState | null; pulse: [number, number] | null }
    | { type: 'scene'; payload: ScenePayload | null }
    | PointerMessage
    | { type: 'focus'; part: string | null; tap?: boolean }
    | { type: 'visible'; visible: boolean }
    | { type: 'reduced'; reduced: boolean }
    | { type: 'mock'; mock: WeatherMock; pulse: [number, number] | null }
    | { type: 'lose' };

export interface SceneTag {
    id: string;
    text: string;
    x: number;
    y: number;
    tone: string;
    align: string;
}

/** What the scene on screen shows, for the DOM beside it: the callout, the engraved tags, the accessible part list. */
export interface SceneReport {
    type: 'scene';
    id: SceneId | null;
    /** Newest payload rev the scene was given, and the rev it has finished settling on (-1 while moving). */
    rev: number;
    settled: number;
    hovered: string | null;
    active: string | null;
    callout: string;
    about: string;
    summary: string;
    turned: boolean;
    tags: SceneTag[];
    parts: { id: string; label: string }[];
    /** Only on a forced test tier: each part's box in scene-local CSS px. */
    rects: Record<string, PartRect> | null;
    navigate: string | null;
}

export type EngineReply =
    | { type: 'drawn'; frames: number; fps: number; mode: FrameMode; pulsing: boolean; width: number; height: number }
    | { type: 'quality'; quality: Quality }
    | { type: 'failed'; software: boolean }
    | SceneReport;

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

type Mood = Pick<Weather, 'tension' | 'warp' | 'drift' | 'contrast'>;
const MOOD_KEYS = ['tension', 'warp', 'drift', 'contrast'] as const;

function pick(weather: Weather): Mood {
    return { tension: weather.tension, warp: weather.warp, drift: weather.drift, contrast: weather.contrast };
}

const loadScene = (id: SceneId): Promise<SceneFactory> =>
    import('./scenes/index.ts').then((module) => module.loadScene(id));

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
    let surface = { width: 0, height: 0, scale: 1 };

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

    let canvasRect: ClientRect = { left: 0, top: 0, width: 1, height: 1 };
    let plates: Rect[] = [];
    let sceneWindow: ClientRect | null = null;

    let wanted: ScenePayload | null = null;
    let scene: Scene | null = null;
    let sceneRev = -1;
    let settledRev = -1;
    let sceneMoving = false;
    let camera: Camera | null = null;
    let lastFrame: Frame | null = null;
    let orbit: Orbit = HOME;
    let hovered: string | null = null;
    let focused: string | null = null;
    let press: { x: number; y: number; lastX: number; lastY: number; moved: boolean; mouse: boolean } | null = null;
    /** Where a hovering mouse last was: a scene that moves under a still pointer is picked again there. */
    let resting: { ndcX: number; ndcY: number } | null = null;
    const lift = new Map<string, number>();
    let navigate: string | null = null;
    let lastReport = '';

    const settings = () => settingsFor(quality, tier);
    const calm = () => reduced || quality === 'still';
    const active = () => hovered ?? focused;

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
    }

    function liftMoving(): boolean {
        const on = active();
        for (const [part, value] of lift) if (Math.abs(value - (part === on ? 1 : 0)) > 0.01) return true;
        return on !== null && !lift.has(on);
    }

    function animating(): boolean {
        if (sceneMoving || moving(orbit) || liftMoving()) return true;
        if (calm()) return false;
        return intro < INTRO_SECONDS || pulse >= 0 || (mood !== null && moodSettling(mood.tension, target().tension));
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
        const size = renderer.resize(view.width, view.height, scale);
        surface = { width: size.width, height: size.height, scale: size.scale };
        invalidate();
    }

    function advance(dt: number): void {
        orbit = stepOrbit(orbit, dt);
        const on = active();
        for (const part of new Set([...lift.keys(), ...(on ? [on] : [])])) {
            const goal = part === on ? 1 : 0;
            const next = reduced ? goal : approach(lift.get(part) ?? 0, goal, dt, LIFT_SECONDS);
            if (goal === 0 && next < 0.01) lift.delete(part);
            else lift.set(part, Math.abs(next - goal) < 0.01 ? goal : next);
        }
        if (scene) {
            sceneMoving = scene.step(calm() ? 10 : dt);
            if (!sceneMoving) settledRev = sceneRev;
        }

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
    }

    function weatherFrame(): WeatherFrame {
        const now = mood ?? pick(target());
        return {
            time,
            seed,
            warp: now.warp,
            drift: now.drift,
            contrast: now.contrast,
            intro: calm() ? 1 : smooth(intro / INTRO_SECONDS),
            pulse: [origin[0], origin[1], pulse],
            plates,
        };
    }

    function windowView(): { width: number; height: number } | null {
        if (!sceneWindow || sceneWindow.width < 2 || sceneWindow.height < 2) return null;
        return { width: sceneWindow.width, height: sceneWindow.height };
    }

    /** The scene draws only while its window is on screen at all. */
    function onScreen(rect: ClientRect): boolean {
        return (
            rect.top < canvasRect.top + canvasRect.height &&
            rect.top + rect.height > canvasRect.top &&
            rect.left < canvasRect.left + canvasRect.width &&
            rect.left + rect.width > canvasRect.left
        );
    }

    function draw(): void {
        if (!renderer) return;
        const size = windowView();
        let sceneDraw = null;
        if (scene && size && sceneWindow && onScreen(sceneWindow)) {
            const spec = scene.camera(size);
            camera = cameraFor(spec, orbit, size);
            lastFrame = scene.frame(size, active());
            if (resting && !press) {
                const under = pickPart(camera, lastFrame.items, resting.ndcX, resting.ndcY);
                if (under !== hovered) {
                    hovered = under;
                    lastFrame = scene.frame(size, active());
                }
            }
            sceneDraw = {
                viewport: sceneViewport(sceneWindow, canvasRect, surface.scale),
                camera,
                ortho: spec.kind === 'ortho',
                items: lastFrame.items,
                ground: lastFrame.ground,
                shadows: lastFrame.shadows,
                lift,
            };
        } else {
            camera = null;
            lastFrame = null;
        }
        renderer.draw(weatherFrame(), sceneDraw);
        frames += 1;
        sendScene();
    }

    function sendScene(): void {
        const size = windowView();
        const on = active();
        const tags =
            camera && lastFrame && size
                ? lastFrame.tags.flatMap((tag) => {
                      const at = projectPoint(camera as Camera, tag.at, size);
                      return at
                          ? [
                                {
                                    id: tag.id,
                                    text: tag.text,
                                    x: Math.round(at[0] * 2) / 2,
                                    y: Math.round(at[1] * 2) / 2,
                                    tone: tag.tone ?? 'dim',
                                    align: tag.align ?? 'middle',
                                },
                            ]
                          : [];
                  })
                : [];
        const message: SceneReport = {
            type: 'scene',
            id: scene?.id ?? null,
            rev: sceneRev,
            settled: sceneMoving ? -1 : settledRev,
            hovered,
            active: on,
            callout: scene && on ? scene.describe(on) : '',
            about: scene?.about ?? '',
            summary: scene?.summary() ?? '',
            turned: turned(orbit),
            tags,
            parts: scene?.parts() ?? [],
            rects: pinned && camera && lastFrame && size ? partRects(camera, lastFrame.items, size) : null,
            navigate,
        };
        const key = JSON.stringify(message);
        if (key === lastReport) return;
        lastReport = key;
        navigate = null;
        reply(message);
    }

    function report(force = false): void {
        const now = performance.now();
        const pulsing = pulse >= 0;
        const due = frames !== reported.frames && (force || now - reported.at >= REPORT_MS);
        if (pulsing === reported.pulsing && !due) return;
        reported = { frames, pulsing, at: now };
        reply({ type: 'drawn', frames, fps, mode: lastMode, pulsing, width: surface.width, height: surface.height });
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
            scene?.pulse();
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

    function resetInteraction(): void {
        resting = null;
        orbit = HOME;
        hovered = null;
        focused = null;
        press = null;
        lift.clear();
    }

    /** Latest wins: a payload for the scene on screen updates it; any other scene is hidden at once and loaded. */
    function setScene(payload: ScenePayload | null): void {
        wanted = payload;
        if (!payload) {
            scene = null;
            sceneRev = -1;
            settledRev = -1;
            resetInteraction();
            invalidate();
            return;
        }
        if (scene && scene.id === payload.data.id) {
            if (payload.rev <= sceneRev) return;
            scene.set(payload.data, calm());
            sceneRev = payload.rev;
            sceneMoving = true;
            invalidate();
            return;
        }
        scene = null;
        sceneRev = -1;
        settledRev = -1;
        resetInteraction();
        invalidate();
        const id = payload.data.id;
        loadScene(id)
            .then((factory) => {
                const latest = wanted;
                if (!latest || latest.data.id !== id || (scene && scene.id === id)) return;
                const created = factory(calm);
                created.set(latest.data, true);
                scene = created;
                sceneRev = latest.rev;
                sceneMoving = true;
                invalidate();
            })
            .catch(() => {});
    }

    function onPointer(message: PointerMessage): void {
        if (!scene || !camera || !lastFrame) {
            hovered = null;
            return;
        }
        const spec = windowView() ? scene.camera(windowView() as { width: number; height: number }) : null;
        switch (message.kind) {
            case 'down':
                if (!message.inside) return;
                press = {
                    x: message.cssX,
                    y: message.cssY,
                    lastX: message.cssX,
                    lastY: message.cssY,
                    moved: false,
                    mouse: message.mouse,
                };
                break;
            case 'move':
                if (press && spec) {
                    const dx = message.cssX - press.lastX;
                    const dy = message.cssY - press.lastY;
                    press.lastX = message.cssX;
                    press.lastY = message.cssY;
                    if (Math.hypot(message.cssX - press.x, message.cssY - press.y) > TAP_SLOP) press.moved = true;
                    if (press.moved) orbit = dragOrbit(orbit, dx, dy, spec, press.mouse);
                } else {
                    hovered = message.inside ? pickPart(camera, lastFrame.items, message.ndcX, message.ndcY) : null;
                    resting = message.inside && message.mouse ? { ndcX: message.ndcX, ndcY: message.ndcY } : null;
                }
                break;
            case 'up': {
                if (press && !press.moved && message.inside) {
                    const part = pickPart(camera, lastFrame.items, message.ndcX, message.ndcY);
                    focused = part;
                    if (!message.mouse) hovered = null;
                    if (part && scene.tap) navigate = scene.tap(part);
                }
                press = null;
                orbit = releaseOrbit(orbit, reduced);
                if (message.mouse && message.inside)
                    hovered = pickPart(camera, lastFrame.items, message.ndcX, message.ndcY);
                break;
            }
            case 'leave':
                resting = null;
                if (!press) hovered = null;
                break;
            case 'cancel':
                resting = null;
                press = null;
                hovered = null;
                orbit = releaseOrbit(orbit, reduced);
                break;
        }
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
            case 'layout':
                // The window moved under a still pointer (a scroll): what was hovered is no longer under it.
                if (
                    resting &&
                    (message.window?.top !== sceneWindow?.top || message.window?.left !== sceneWindow?.left)
                ) {
                    resting = null;
                    hovered = null;
                }
                canvasRect = message.canvas;
                plates = message.plates;
                sceneWindow = message.window;
                invalidate();
                return;
            case 'chain':
                setChain(message);
                return;
            case 'scene':
                setScene(message.payload);
                return;
            case 'pointer':
                onPointer(message);
                return;
            case 'focus':
                focused = message.part;
                if (message.tap && message.part && scene?.tap) navigate = scene.tap(message.part);
                invalidate();
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
                if (reduced) {
                    settleAll();
                    orbit = press ? orbit : HOME;
                }
                invalidate();
                return;
            case 'mock':
                mock = message.mock;
                if (calm()) mood = pick(target());
                if (message.pulse && !calm()) {
                    startPulse(message.pulse);
                    scene?.pulse();
                }
                invalidate();
                return;
            case 'lose':
                renderer?.simulateLoss();
                return;
        }
    };
}
