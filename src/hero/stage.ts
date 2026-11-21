import { NeutralToneMapping, WebGLRenderer } from 'three';
import { TOKENS } from '../styles/tokens.ts';
import type { Handle, MachineId, Stage, ViewOptions } from './bus.ts';
import type { Machine, MachineFactory } from './machine.ts';
import { detectMode, forcedMode, isSoftwareRenderer } from './tier.ts';

const FACTORIES: Record<MachineId, () => Promise<MachineFactory<never>>> = {
    miner: () => import('./machines/miner.ts').then((module) => module.createMiner),
    sats: () => import('./machines/sats.ts').then((module) => module.createSats),
    wall: () => import('./machines/wall.ts').then((module) => module.createWall),
    halving: () => import('./machines/halving.ts').then((module) => module.createHalving),
    queue: () => import('./machines/queue.ts').then((module) => module.createQueue),
    melt: () => import('./machines/melt.ts').then((module) => module.createMelt),
    stack: () => import('./machines/stack.ts').then((module) => module.createStack),
    address: () => import('./machines/address.ts').then((module) => module.createAddress),
};

/** Lower pixel ratios, tried in turn while frames stay slow. */
const SCALES = [1, 0.8, 0.62, 0.5];
const SLOW_FRAME_SECONDS = 1 / 40;
const SAMPLE_FRAMES = 90;
/** How far one full drag across a box turns its scene. */
const DRAG_TURN = Math.PI * 0.6;
/** A drag turns a scene this far either way at most, so it can be looked around but never lost. */
const MAX_TURN = 0.75;

interface Slot {
    element: HTMLElement;
    page: boolean;
    machine: Machine<unknown> | null;
    input: unknown;
    pointer: { x: number; y: number };
    target: { x: number; y: number };
    turn: number;
    turnTarget: number;
    seconds: number;
    visible: boolean;
    dirty: boolean;
    unbind: () => void;
}

function openContext(): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext } | null {
    if (detectMode() === 'still') return null;
    const forced = forcedMode() === 'scene';
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: !forced,
    });
    if (!gl || (!forced && isSoftwareRenderer(gl))) return null;
    return { canvas, gl };
}

/** Waits for a quiet moment, so building one scene never lands in the same task as another. */
function idle(): Promise<void> {
    return new Promise((resolve) => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 500 });
        else setTimeout(resolve, 50);
    });
}

function bindPointer(slot: Slot): () => void {
    let dragFrom: number | null = null;
    let turnFrom = 0;
    const element = slot.element;
    const move = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        slot.target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        slot.target.y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
        if (dragFrom === null) return;
        const turn = turnFrom + ((event.clientX - dragFrom) / rect.width) * DRAG_TURN;
        slot.turnTarget = Math.max(-MAX_TURN, Math.min(MAX_TURN, turn));
    };
    const down = (event: PointerEvent) => {
        if (!slot.page) return;
        dragFrom = event.clientX;
        turnFrom = slot.turnTarget;
        element.setPointerCapture(event.pointerId);
    };
    const up = () => {
        dragFrom = null;
    };
    const leave = () => {
        slot.target.x = 0;
        slot.target.y = 0;
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('pointerleave', leave);
    return () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerdown', down);
        element.removeEventListener('pointerup', up);
        element.removeEventListener('pointercancel', up);
        element.removeEventListener('pointerleave', leave);
    };
}

/**
 * One canvas and one context for the whole visit, fixed behind the page. Every box a page lends the stage gets
 * its own scene, drawn into that box's place on the screen; boxes out of view are skipped.
 */
export function runStage(): Stage | null {
    const root = document.documentElement;
    const surface = openContext();
    if (!surface) {
        root.dataset.scene = 'still';
        return null;
    }
    const { canvas, gl } = surface;
    document.body.prepend(canvas);
    const renderer = new WebGLRenderer({ canvas, context: gl, antialias: true });
    renderer.toneMapping = NeutralToneMapping;
    renderer.autoClear = false;
    renderer.setClearColor(TOKENS.void, 1);
    const parallel = renderer.extensions.has('KHR_parallel_shader_compile');

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const phone = window.matchMedia('(pointer: coarse)').matches;
    const slots = new Set<Slot>();
    let scale = 0;
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let slowTotal = 0;
    let slowCount = 0;
    let lost = false;
    let shown = false;
    let queue: Promise<void> = Promise.resolve();

    function resize(): void {
        const nextWidth = canvas.clientWidth;
        const nextHeight = canvas.clientHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2) * (SCALES[scale] ?? 1);
        if (nextWidth === width && nextHeight === height && renderer.getPixelRatio() === ratio) return;
        width = nextWidth;
        height = nextHeight;
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        for (const slot of slots) slot.dirty = true;
    }

    function measure(delta: number): void {
        if (delta > 0.25 || delta === 0) return;
        slowTotal += delta;
        slowCount += 1;
        if (slowCount < SAMPLE_FRAMES) return;
        const average = slowTotal / slowCount;
        root.dataset.fps = (1 / average).toFixed(0);
        slowTotal = 0;
        slowCount = 0;
        if (average > SLOW_FRAME_SECONDS && scale < SCALES.length - 1 && forcedMode() !== 'scene') {
            scale += 1;
            resize();
        }
    }

    function draw(delta: number): void {
        resize();
        const still = motion.matches;
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.setScissorTest(true);
        let drew = 0;
        for (const slot of slots) {
            const machine = slot.machine;
            const rect = slot.element.getBoundingClientRect();
            slot.visible = rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
            if (!machine || !slot.visible || rect.width < 2 || rect.height < 2) continue;
            const step = still ? 0 : delta;
            slot.seconds += step;
            slot.pointer.x += (slot.target.x - slot.pointer.x) * (still ? 1 : 1 - Math.exp(-4 * delta));
            slot.pointer.y += (slot.target.y - slot.pointer.y) * (still ? 1 : 1 - Math.exp(-4 * delta));
            slot.turn += (slot.turnTarget - slot.turn) * (still ? 1 : 1 - Math.exp(-6 * delta));
            machine.frame({
                seconds: slot.seconds,
                delta: step,
                aspect: rect.width / rect.height,
                pixels: rect.height * renderer.getPixelRatio(),
                still,
                // Scenes orbit their camera, so the signs flip here: the object then turns the way the mouse goes.
                pointer: still ? { x: 0, y: 0 } : { x: -slot.pointer.x, y: -slot.pointer.y },
                turn: -slot.turn,
                page: slot.page,
            });
            const left = Math.round(rect.left);
            const bottom = Math.round(height - rect.bottom);
            renderer.setViewport(left, bottom, Math.round(rect.width), Math.round(rect.height));
            renderer.setScissor(left, bottom, Math.round(rect.width), Math.round(rect.height));
            renderer.render(machine.scene, machine.camera);
            slot.dirty = false;
            drew += 1;
        }
        if (drew > 0 && !shown) {
            shown = true;
            root.dataset.scene = 'live';
        }
    }

    function tick(now: number): void {
        raf = 0;
        if (lost || document.hidden || slots.size === 0) return;
        const delta = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
        last = now;
        if (motion.matches) {
            if ([...slots].some((slot) => slot.dirty)) draw(0);
            return;
        }
        measure(delta);
        draw(delta);
        raf = requestAnimationFrame(tick);
    }

    function wake(): void {
        if (raf !== 0 || lost || document.hidden) return;
        last = 0;
        raf = requestAnimationFrame(tick);
    }

    const redrawStill = () => {
        if (!motion.matches) return;
        for (const slot of slots) slot.dirty = true;
        wake();
    };
    window.addEventListener('scroll', redrawStill, { passive: true });
    window.addEventListener('resize', redrawStill);
    document.addEventListener('visibilitychange', wake);
    motion.addEventListener('change', () => {
        for (const slot of slots) slot.dirty = true;
        wake();
    });
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        lost = true;
        root.dataset.scene = 'still';
    });
    canvas.addEventListener('webglcontextrestored', () => {
        lost = false;
        root.dataset.scene = 'live';
        for (const slot of slots) slot.dirty = true;
        wake();
    });

    return {
        add(element, id, input, options: ViewOptions): Handle {
            const slot: Slot = {
                element,
                page: options.page === true,
                machine: null,
                input,
                pointer: { x: 0, y: 0 },
                target: { x: 0, y: 0 },
                turn: 0,
                turnTarget: 0,
                seconds: 0,
                visible: false,
                dirty: true,
                unbind: () => {},
            };
            slot.unbind = bindPointer(slot);
            slots.add(slot);
            element.dataset.scene = 'loading';
            const build = () =>
                FACTORIES[id]()
                    .then(async (factory) => {
                        if (!slots.has(slot)) return;
                        await idle();
                        if (!slots.has(slot)) return;
                        const machine = (factory as MachineFactory<unknown>)(slot.input, slot.page);
                        // Programs compile in the background, so no frame stops to build them.
                        if (parallel) await renderer.compileAsync(machine.scene, machine.camera).catch(() => {});
                        else {
                            // Without parallel compiling, one object at a time between idle moments, so no single
                            // task builds every program of a scene.
                            for (const child of [...machine.scene.children]) {
                                await idle();
                                renderer.compile(child, machine.camera, machine.scene);
                            }
                        }
                        if (!slots.has(slot)) {
                            machine.dispose();
                            return;
                        }
                        machine.set(slot.input);
                        slot.machine = machine;
                        element.dataset.scene = 'live';
                        slot.dirty = true;
                        wake();
                    })
                    .catch(() => {
                        element.dataset.scene = 'still';
                    });
            // A scene is built when its box first comes near the screen, so a long page never builds them all at once.
            const near = new IntersectionObserver(
                ([entry]) => {
                    if (!entry?.isIntersecting) return;
                    near.disconnect();
                    queue = queue.then(build);
                },
                { rootMargin: '10% 0px' },
            );
            near.observe(element);
            slot.unbind = ((unbind) => () => {
                near.disconnect();
                unbind();
            })(slot.unbind);
            wake();
            return {
                set(next) {
                    slot.input = next;
                    slot.machine?.set(next);
                    slot.dirty = true;
                    if (motion.matches) wake();
                },
                remove() {
                    slots.delete(slot);
                    slot.unbind();
                    slot.machine?.dispose();
                    slot.machine = null;
                    delete element.dataset.scene;
                    if (slots.size === 0) {
                        renderer.setScissorTest(false);
                        renderer.clear();
                    }
                },
            };
        },
    };
}
