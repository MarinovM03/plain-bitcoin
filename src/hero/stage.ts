import type { BackdropData } from '../backdrop/types.ts';
import { formingFill } from '../chain/forming.ts';
import { chainOffsets } from '../chain/shape.ts';
import { arrivalCamera, type Camera, homeCamera, mixCamera, withDrift } from '../chain/view.ts';
import { createCast, poseOf, TIMING } from './actors.ts';
import type { Hero, HeroFrame, SceneId } from './bus.ts';
import type { Core } from './core.ts';
import type { ChainDraw, Layer, Tick } from './kit.ts';
import { detectMode, forcedMode, isSoftwareRenderer } from './tier.ts';

/**
 * Each step draws less: no bloom, then fewer pixels, then no shadows. Past the last step the still takes over.
 * Phones start on the second step: the bloom is a desktop nicety and costs a phone its smooth start.
 */
const STEPS = [
    { scale: 1, bloom: true, shadows: true, glass: true },
    { scale: 1, bloom: false, shadows: true, glass: true },
    { scale: 0.75, bloom: false, shadows: true, glass: true },
    { scale: 0.55, bloom: false, shadows: false, glass: false },
] as const;
/** Slower than this on average and the scene steps down. */
const SLOW_FRAME_SECONDS = 1 / 26;
const SAMPLE_FRAMES = 75;
const RUSH_SECONDS = 0.45;
/** One scene gives way to the next in this long; the camera never flies between them. */
const FADE_SECONDS = 0.45;
/** After the last tablet lands the camera takes this long to finish pulling back. */
const SETTLE_SECONDS = 1.2;

interface Shown {
    id: SceneId;
    layer: Layer;
}

function easeInOut(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function openCanvas(): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext } | null {
    const forced = forcedMode() === 'scene';
    const canvas = document.createElement('canvas');
    canvas.className = 'world__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        depth: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: !forced,
    });
    if (!gl || (!forced && isSoftwareRenderer(gl))) return null;
    return { canvas, gl };
}

const INERT: Hero = { show() {}, open() {}, backdrop() {} };

/**
 * The world behind every page: one canvas, one context and one renderer for the whole visit, with one scene per
 * page that fades in over the last. It is checked for a real GPU before the 3D library is fetched, so a phone that
 * will only ever show the still never pays for it.
 */
export function runHero(host: HTMLElement): Hero {
    const root = document.documentElement;
    const mark = (mode: 'scene' | 'lite' | 'still') => {
        host.dataset.hero = mode === 'still' ? 'still' : 'scene';
        root.dataset.world = mode;
    };
    mark('still');
    const surface = detectMode() === 'scene' ? openCanvas() : null;
    if (!surface) return INERT;
    const { canvas } = surface;

    const cast = createCast();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const phone = window.matchMedia('(pointer: coarse)').matches;
    const dprCap = phone ? 1.5 : 2;
    let core: Core | null = null;
    let frame: HeroFrame | null = null;
    let data: BackdropData | null = null;
    let scene: SceneId = 'home';
    let front: Shown | null = null;
    let back: Shown | null = null;
    let fade = 1;
    let request = 0;
    let loading: SceneId | null = null;
    let introPlayed = false;
    let travel: { from: Camera; t: number; seconds: number } | null = null;
    let raf = 0;
    let last = 0;
    let lastTick = 0;
    let skipped = false;
    let seconds = 0;
    let frames = 0;
    let lost = false;
    let gaveUp = false;
    let step = phone ? 1 : 0;
    let slowTotal = 0;
    let slowCount = 0;
    let width = 0;
    let height = 0;
    let shownFill = 0;
    let shownGhost = 0;
    let sinceIntro = 0;
    let introSeconds = 0;
    let sinceSnap = Number.POSITIVE_INFINITY;

    const nowSeconds = () => Date.now() / 1000;
    const hasBlocks = () => frame !== null && frame.blocks.length > 0;
    const drawing = () => core !== null && front !== null && !gaveUp && !lost && width > 1;
    const animating = () => drawing() && !document.hidden && !motion.matches;

    function size(): void {
        if (!core) return;
        const rect = host.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        if (width < 2 || height < 2) return;
        const quality = STEPS[step] ?? STEPS[0];
        core.resize(width, height, Math.min(window.devicePixelRatio || 1, dprCap) * quality.scale);
        core.quality(quality);
    }

    function targets(): { fill: number; ghost: number } {
        if (!frame || frame.formingSince === null) return { fill: 0, ghost: 0 };
        const fill = formingFill(nowSeconds() - frame.formingSince);
        if (sinceSnap < RUSH_SECONDS) return { fill: 1.12, ghost: 1 };
        if (sinceIntro < introSeconds) return { fill: 0, ghost: 0 };
        return { fill, ghost: 1 };
    }

    function chain(): ChainDraw {
        const home = homeCamera(width / height);
        const steady = motion.matches ? home : withDrift(home, seconds);
        return {
            camera: travel ? mixCamera(travel.from, steady, easeInOut(travel.t)) : steady,
            slabs: cast.actors.map((actor) => ({ actor, pose: poseOf(actor) })),
            ghost: shownGhost,
            fill: shownFill,
        };
    }

    function tickFor(id: SceneId): Tick {
        return {
            seconds,
            width,
            height,
            pixels: core?.pixels() ?? 1,
            still: motion.matches,
            hash: frame?.blocks[0]?.hash ?? null,
            chain: id === 'home' ? chain() : null,
            data: id === 'home' ? null : data,
        };
    }

    function retire(): void {
        back?.layer.dispose();
        back = null;
        fade = 1;
    }

    function draw(): void {
        if (!core || !front || !drawing()) return;
        front.layer.update(tickFor(front.id));
        back?.layer.update(tickFor(back.id));
        core.draw(front.layer, back?.layer ?? null, easeInOut(fade));
        frames += 1;
        host.dataset.frames = String(frames);
        host.dataset.scene = front.id;
        if (frames === 1) mark(STEPS[step]?.glass ? 'scene' : 'lite');
    }

    function giveUp(): void {
        gaveUp = true;
        cancelAnimationFrame(raf);
        raf = 0;
        retire();
        front?.layer.dispose();
        front = null;
        canvas.remove();
        mark('still');
    }

    function measure(delta: number): void {
        if (seconds < 1.5 || delta > 0.25) return;
        slowTotal += delta;
        slowCount += 1;
        if (slowCount < SAMPLE_FRAMES) return;
        const average = slowTotal / slowCount;
        host.dataset.fps = (1 / average).toFixed(0);
        slowTotal = 0;
        slowCount = 0;
        if (average <= SLOW_FRAME_SECONDS || forcedMode() === 'scene') return;
        if (step < STEPS.length - 1) {
            step += 1;
            size();
            mark(STEPS[step]?.glass ? 'scene' : 'lite');
        } else {
            giveUp();
        }
    }

    function tick(now: number): void {
        raf = 0;
        if (!animating()) return;
        measure(Math.max(0, (now - lastTick) / 1000));
        lastTick = now;
        raf = requestAnimationFrame(tick);
        // Behind a tool the world is scenery: every other frame is enough unless something is changing hands.
        const busy = back !== null || sinceSnap < 2 || sinceIntro < introSeconds + SETTLE_SECONDS;
        if (front?.id !== 'home' && !busy && !skipped) {
            skipped = true;
            return;
        }
        skipped = false;
        const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        seconds += delta;
        sinceIntro += delta;
        sinceSnap += delta;
        if (back) {
            fade += delta / FADE_SECONDS;
            if (fade >= 1) retire();
        }
        if (travel) {
            travel.t += delta / travel.seconds;
            if (travel.t >= 1) travel = null;
        }
        const target = targets();
        shownFill += (target.fill - shownFill) * (1 - Math.exp(-delta * (target.fill > shownFill ? 7 : 2.2)));
        shownGhost += (target.ghost - shownGhost) * (1 - Math.exp(-delta * 2.5));
        if (frame) cast.retarget(chainOffsets(frame.blocks, frame.formingSince === null ? null : nowSeconds()));
        cast.step(delta);
        draw();
    }

    /** One finished frame, nothing in motion: reduced motion, and any change while the loop is parked. */
    function still(): void {
        cast.settle();
        travel = null;
        retire();
        const target = targets();
        shownFill = Math.min(1, target.fill);
        shownGhost = target.ghost;
        draw();
    }

    function wake(): void {
        if (!drawing()) return;
        if (motion.matches) {
            cancelAnimationFrame(raf);
            raf = 0;
            sinceIntro = Number.POSITIVE_INFINITY;
            sinceSnap = Number.POSITIVE_INFINITY;
            still();
            return;
        }
        if (raf === 0 && animating()) {
            last = performance.now();
            lastTick = last;
            raf = requestAnimationFrame(tick);
        }
    }

    /** The first time the chain is seen on a visit it plays its entrance from the start, wherever the visit began. */
    function playIntro(): void {
        if (introPlayed || !frame) return;
        introPlayed = true;
        cast.sync(
            frame.blocks,
            chainOffsets(frame.blocks, frame.formingSince === null ? null : nowSeconds()),
            'replay',
        );
        sinceIntro = 0;
        introSeconds = Math.max(0, frame.blocks.length - 1) * TIMING.dropStagger + TIMING.dropSeconds;
        if (!motion.matches) {
            travel = { from: arrivalCamera(width / height), t: 0, seconds: introSeconds + SETTLE_SECONDS };
        }
    }

    function arrive(next: Shown): void {
        retire();
        back = front;
        front = next;
        fade = back && !motion.matches ? 0 : 1;
        if (fade >= 1) retire();
        if (next.id === 'home') playIntro();
        if (!canvas.isConnected) host.append(canvas);
        wake();
        if (raf === 0 && drawing()) still();
    }

    /** Fetches and builds the open page's scene. The one on show keeps running until the next is ready to draw. */
    function want(): void {
        if (!core || gaveUp || lost) return;
        if (front?.id === scene) {
            request += 1;
            loading = null;
            return;
        }
        if (loading === scene || (scene === 'home' && !hasBlocks())) return;
        size();
        if (width < 2 || height < 2) return;
        const running = core;
        const id = scene;
        const token = ++request;
        loading = id;
        running
            .load(id)
            .then(async (layer) => {
                layer.update(tickFor(id));
                await running.warm(layer).catch(() => {});
                if (token !== request || gaveUp) {
                    layer.dispose();
                    return;
                }
                loading = null;
                arrive({ id, layer });
            })
            .catch(() => {
                if (token !== request) return;
                loading = null;
                if (!front) giveUp();
            });
    }

    new ResizeObserver(() => {
        size();
        want();
        if (motion.matches && drawing()) still();
    }).observe(host);

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        lost = true;
        cancelAnimationFrame(raf);
        raf = 0;
        mark('still');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        if (gaveUp) return;
        lost = false;
        frames = 0;
        size();
        wake();
    });
    document.addEventListener('visibilitychange', wake);
    motion.addEventListener('change', wake);

    import('./core.ts')
        .then(({ createCore }) => {
            core = createCore(canvas, surface.gl);
            want();
        })
        .catch(giveUp);

    return {
        show(next) {
            const first = !hasBlocks();
            frame = next;
            const effect = first ? 'replay' : next.effect;
            cast.sync(next.blocks, chainOffsets(next.blocks, next.formingSince === null ? null : nowSeconds()), effect);
            if (effect === 'replay' && front?.id === 'home') {
                sinceIntro = 0;
                introSeconds = Math.max(0, next.blocks.length - 1) * TIMING.dropStagger + TIMING.dropSeconds;
            }
            if (effect === 'snap') sinceSnap = 0;
            want();
            wake();
            if (!motion.matches && raf === 0 && drawing()) still();
        },
        open(next) {
            scene = next;
            want();
        },
        backdrop(next) {
            data = next;
            if (raf === 0 && drawing()) still();
        },
    };
}
