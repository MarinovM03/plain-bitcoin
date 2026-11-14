import { formingFill } from '../chain/forming.ts';
import { chainOffsets } from '../chain/shape.ts';
import {
    arrivalCamera,
    type Camera,
    mixCamera,
    NOMINAL_REACH,
    type Reach,
    type Station,
    stationCamera,
    withPointer,
} from '../chain/view.ts';
import { createCast, poseOf, TIMING } from './actors.ts';
import type { Hero, HeroFrame } from './bus.ts';
import { pointerToScene } from './pointer.ts';
import type { DrawList, World } from './scene.ts';
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
const TRAVEL_SECONDS = 1.1;
/** After the last tablet lands the camera takes this long to finish pulling back. */
const SETTLE_SECONDS = 1.2;
const LEVEL = { home: 1, tool: 0.55 } as const;

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

const INERT: Hero = { show() {}, travel() {}, scroll() {} };

/**
 * The world behind every page: one canvas and one context for the whole visit. It is checked for a real GPU before
 * the 3D library is fetched, so a phone that will only ever show the still never pays for it.
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
    let world: World | null = null;
    let frame: HeroFrame | null = null;
    let station: Station = 'home';
    let travel: { from: Camera; t: number; seconds: number } | null = null;
    let shownCamera: Camera | null = null;
    let scrollTarget = 0;
    let scrollShown = 0;
    let level: number = LEVEL.home;
    let raf = 0;
    let last = 0;
    let lastTick = 0;
    let skipped = false;
    let seconds = 0;
    let frames = 0;
    let lost = false;
    let gaveUp = false;
    let warmed = false;
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
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const nowSeconds = () => Date.now() / 1000;
    const drawing = () =>
        world !== null && warmed && !gaveUp && !lost && frame !== null && frame.blocks.length > 0 && width > 1;
    const animating = () => drawing() && !document.hidden && !motion.matches;

    function size(): void {
        if (!world) return;
        const rect = host.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        if (width < 2 || height < 2) return;
        const quality = STEPS[step] ?? STEPS[0];
        world.resize(width, height, Math.min(window.devicePixelRatio || 1, dprCap) * quality.scale);
        world.quality(quality);
    }

    function reach(): Reach {
        const standing = cast.actors.filter((actor) => actor.leaving === null).map((actor) => actor.target);
        if (standing.length === 0) return NOMINAL_REACH;
        return { first: Math.min(...standing), last: Math.max(...standing) };
    }

    function targets(): { fill: number; ghost: number } {
        if (!frame || frame.formingSince === null) return { fill: 0, ghost: 0 };
        const fill = formingFill(nowSeconds() - frame.formingSince);
        if (sinceSnap < RUSH_SECONDS) return { fill: 1.12, ghost: 1 };
        if (sinceIntro < introSeconds) return { fill: 0, ghost: 0 };
        return { fill, ghost: 1 };
    }

    function list(): DrawList {
        const goal = stationCamera(station, width / height, reach(), scrollShown);
        shownCamera = travel ? mixCamera(travel.from, goal, easeInOut(travel.t)) : goal;
        return {
            camera: withPointer(shownCamera, pointer),
            slabs: cast.actors.map((actor) => ({ actor, pose: poseOf(actor) })),
            ghost: shownGhost,
            fill: shownFill,
            seconds,
            hash: frame?.blocks[0]?.hash ?? null,
            level,
        };
    }

    function draw(): void {
        if (!world || !drawing()) return;
        world.draw(list());
        frames += 1;
        host.dataset.frames = String(frames);
        if (frames === 1) mark(STEPS[step]?.glass ? 'scene' : 'lite');
    }

    function giveUp(): void {
        gaveUp = true;
        cancelAnimationFrame(raf);
        raf = 0;
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
        // Behind a tool the world is scenery: every other frame is enough unless the camera is on the move.
        const busy = travel !== null || sinceSnap < 2 || sinceIntro < introSeconds + SETTLE_SECONDS;
        if (station !== 'home' && !busy && !skipped) {
            skipped = true;
            return;
        }
        skipped = false;
        const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        seconds += delta;
        sinceIntro += delta;
        sinceSnap += delta;
        const follow = 1 - Math.exp(-delta * 3);
        pointer.x += (pointer.targetX - pointer.x) * follow;
        pointer.y += (pointer.targetY - pointer.y) * follow;
        scrollShown += (scrollTarget - scrollShown) * (1 - Math.exp(-delta * 5));
        level += ((station === 'home' ? LEVEL.home : LEVEL.tool) - level) * follow;
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
        scrollShown = scrollTarget;
        level = station === 'home' ? LEVEL.home : LEVEL.tool;
        const target = targets();
        shownFill = Math.min(1, target.fill);
        shownGhost = target.ghost;
        pointer.x = 0;
        pointer.y = 0;
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

    /** The scene takes over from the still once its programs are built, and plays its entrance from the start. */
    function begin(): void {
        if (!world || warmed || gaveUp || !frame || frame.blocks.length === 0) return;
        size();
        if (width < 2 || height < 2) return;
        const ready = () => {
            if (gaveUp) return;
            warmed = true;
            host.append(canvas);
            sinceIntro = 0;
            if (station === 'home' && !motion.matches) {
                travel = { from: arrivalCamera(width / height), t: 0, seconds: introSeconds + SETTLE_SECONDS };
            }
            wake();
        };
        world.warm(list()).then(ready, ready);
    }

    new ResizeObserver(() => {
        size();
        if (!warmed) begin();
        else if (motion.matches) still();
    }).observe(host);

    window.addEventListener(
        'pointermove',
        (event) => {
            const rect = { left: 0, top: 0, width, height };
            const point = pointerToScene(event, rect, rect, 1, 1);
            pointer.targetX = point.inside ? point.ndcX : 0;
            pointer.targetY = point.inside ? point.ndcY : 0;
        },
        { passive: true },
    );
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

    import('./scene.ts')
        .then(({ createScene }) => {
            world = createScene(canvas, surface.gl);
            begin();
        })
        .catch(giveUp);

    return {
        show(next) {
            const first = frame === null || frame.blocks.length === 0;
            frame = next;
            const effect = first ? 'replay' : next.effect;
            cast.sync(next.blocks, chainOffsets(next.blocks, next.formingSince === null ? null : nowSeconds()), effect);
            if (effect === 'replay') {
                sinceIntro = 0;
                introSeconds = Math.max(0, next.blocks.length - 1) * TIMING.dropStagger + TIMING.dropSeconds;
            }
            if (effect === 'snap') sinceSnap = 0;
            if (!warmed) begin();
            wake();
            if (!motion.matches && raf === 0 && drawing()) still();
        },
        travel(next) {
            if (next === station) return;
            station = next;
            if (shownCamera && !motion.matches) travel = { from: shownCamera, t: 0, seconds: TRAVEL_SECONDS };
            if (next !== 'home') scrollTarget = 0;
            wake();
            if (raf === 0 && drawing()) still();
        },
        scroll(progress) {
            if (motion.matches) return;
            scrollTarget = station === 'home' ? Math.min(1, Math.max(0, progress)) : 0;
            if (raf === 0 && drawing()) still();
        },
    };
}
