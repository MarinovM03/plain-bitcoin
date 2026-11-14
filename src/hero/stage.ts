import { formingFill } from '../chain/forming.ts';
import { chainOffsets } from '../chain/shape.ts';
import { cameraFor } from '../chain/view.ts';
import { TOKENS } from '../styles/tokens.ts';
import { createCast, poseOf, TIMING } from './actors.ts';
import type { Hero, HeroFrame } from './bus.ts';
import { pointerToScene } from './pointer.ts';
import { createRenderer, type Renderer } from './renderer.ts';
import { detectMode, forcedMode, isSoftwareRenderer } from './tier.ts';

const DPR_CAP = 2;
const SCALES = [1, 0.75, 0.5] as const;
/** Slower than this on average and the scene first draws fewer pixels, then gives way to the still. */
const SLOW_FRAME_SECONDS = 1 / 26;
const SAMPLE_FRAMES = 75;
const RUSH_SECONDS = 0.45;

interface Surface {
    canvas: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    /** Null while the shaders compile in the background, and again after a lost context until they are rebuilt. */
    renderer: Renderer | null;
    ready: Promise<boolean>;
}

function build(target: Surface): Promise<boolean> {
    target.renderer = null;
    target.ready = createRenderer(target.gl, TOKENS.void).then(
        (renderer) => {
            target.renderer = renderer;
            return true;
        },
        () => false,
    );
    return target.ready;
}

// One canvas and one context for the whole visit: leaving home parks it, coming back reuses it.
let surface: Surface | null = null;
let unusable = false;

function openSurface(): Surface | null {
    if (surface) return surface;
    if (unusable) return null;
    const forced = forcedMode() === 'scene';
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        depth: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: !forced,
    });
    if (!gl || (!forced && isSoftwareRenderer(gl))) {
        unusable = true;
        return null;
    }
    surface = { canvas, gl, renderer: null, ready: Promise.resolve(false) };
    build(surface);
    return surface;
}

export function runHero(host: HTMLElement): Hero {
    const cast = createCast();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const live = detectMode() === 'scene' ? openSurface() : null;
    let frame: HeroFrame | null = null;
    let raf = 0;
    let last = 0;
    let seconds = 0;
    let frames = 0;
    let onScreen = false;
    let lost = false;
    let gaveUp = live === null;
    let disposed = false;
    let scaleIndex = 0;
    let slowTotal = 0;
    let slowCount = 0;
    let width = 0;
    let height = 0;
    let rect = host.getBoundingClientRect();
    let shownFill = 0;
    let shownGhost = 0;
    let sinceIntro = 0;
    let introSeconds = 0;
    let sinceSnap = Number.POSITIVE_INFINITY;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // The drawn still stands until the scene can draw its first frame.
    host.dataset.hero = 'still';

    const nowSeconds = () => Date.now() / 1000;
    const drawing = () =>
        live !== null && live.renderer !== null && !gaveUp && !lost && frame !== null && frame.blocks.length > 0;
    const animating = () => drawing() && onScreen && !document.hidden && !motion.matches;

    function size(): void {
        if (!live?.renderer) return;
        rect = host.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        const scale = Math.min(window.devicePixelRatio || 1, DPR_CAP) * (SCALES[scaleIndex] ?? 1);
        const pixelWidth = Math.max(1, Math.round(width * scale));
        const pixelHeight = Math.max(1, Math.round(height * scale));
        if (live.canvas.width !== pixelWidth || live.canvas.height !== pixelHeight) {
            live.canvas.width = pixelWidth;
            live.canvas.height = pixelHeight;
        }
        live.renderer.resize(pixelWidth, pixelHeight);
    }

    function targets(): { fill: number; ghost: number } {
        if (!frame || frame.formingSince === null) return { fill: 0, ghost: 0 };
        const fill = formingFill(nowSeconds() - frame.formingSince);
        if (sinceSnap < RUSH_SECONDS) return { fill: 1.12, ghost: 1 };
        if (sinceIntro < introSeconds) return { fill: 0, ghost: 0 };
        return { fill, ghost: 1 };
    }

    function draw(): void {
        if (!live?.renderer || !drawing() || width < 2 || height < 2) return;
        live.renderer.draw({
            camera: cameraFor(width / height, pointer),
            slabs: cast.actors.map((actor) => ({ actor, pose: poseOf(actor) })),
            ghost: shownGhost,
            fill: shownFill,
            seconds,
        });
        frames += 1;
        host.dataset.frames = String(frames);
    }

    function giveUp(): void {
        gaveUp = true;
        cancelAnimationFrame(raf);
        raf = 0;
        live?.canvas.remove();
        host.dataset.hero = 'still';
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
        if (scaleIndex < SCALES.length - 1) {
            scaleIndex += 1;
            size();
        } else {
            giveUp();
        }
    }

    function tick(now: number): void {
        raf = 0;
        if (!animating()) return;
        const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        seconds += delta;
        sinceIntro += delta;
        sinceSnap += delta;
        const follow = 1 - Math.exp(-delta * 3);
        pointer.x += (pointer.targetX - pointer.x) * follow;
        pointer.y += (pointer.targetY - pointer.y) * follow;
        const target = targets();
        shownFill += (target.fill - shownFill) * (1 - Math.exp(-delta * (target.fill > shownFill ? 7 : 2.2)));
        shownGhost += (target.ghost - shownGhost) * (1 - Math.exp(-delta * 2.5));
        if (frame) cast.retarget(chainOffsets(frame.blocks, frame.formingSince === null ? null : nowSeconds()));
        cast.step(delta);
        draw();
        measure(delta);
        raf = requestAnimationFrame(tick);
    }

    /** One finished frame, nothing in motion: reduced motion, and any change while the loop is parked. */
    function still(): void {
        cast.settle();
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
            raf = requestAnimationFrame(tick);
        }
    }

    const resizes = new ResizeObserver(() => {
        size();
        if (motion.matches) still();
    });
    resizes.observe(host);
    const sightings = new IntersectionObserver((entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        wake();
    });
    sightings.observe(host);

    const onPointer = (event: PointerEvent) => {
        const point = pointerToScene(event, rect, rect, 1, 1);
        pointer.targetX = point.inside ? point.ndcX : 0;
        pointer.targetY = point.inside ? point.ndcY : 0;
    };
    const onScroll = () => {
        rect = host.getBoundingClientRect();
    };
    const onLost = (event: Event) => {
        event.preventDefault();
        lost = true;
        cancelAnimationFrame(raf);
        raf = 0;
        host.dataset.hero = 'still';
    };
    /** The scene takes over from the still once its shaders are built, and plays its entrance from the start. */
    function begin(built: boolean): void {
        if (disposed || gaveUp || !live) return;
        if (!built) {
            unusable = true;
            surface = null;
            giveUp();
            return;
        }
        lost = false;
        host.append(live.canvas);
        host.dataset.hero = 'scene';
        size();
        wake();
        if (!motion.matches && raf === 0) still();
    }

    const onRestored = () => {
        if (!live || gaveUp) return;
        build(live).then(begin);
    };

    document.addEventListener('visibilitychange', wake);
    motion.addEventListener('change', wake);
    if (live) {
        window.addEventListener('pointermove', onPointer, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        live.canvas.addEventListener('webglcontextlost', onLost);
        live.canvas.addEventListener('webglcontextrestored', onRestored);
        live.ready.then(begin);
    }

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
            wake();
            if (!motion.matches && raf === 0 && drawing()) still();
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(raf);
            raf = 0;
            resizes.disconnect();
            sightings.disconnect();
            document.removeEventListener('visibilitychange', wake);
            motion.removeEventListener('change', wake);
            window.removeEventListener('pointermove', onPointer);
            window.removeEventListener('scroll', onScroll);
            live?.canvas.removeEventListener('webglcontextlost', onLost);
            live?.canvas.removeEventListener('webglcontextrestored', onRestored);
            live?.canvas.remove();
        },
    };
}
