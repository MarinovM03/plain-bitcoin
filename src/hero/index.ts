import { HERO } from '../ui/copy.ts';
import { whenIdle } from '../util/dom.ts';
import { prefersReducedMotion } from '../util/motion.ts';
import { type TokenState, tokenState } from './layout.ts';
import type { PlainHero } from './plain.ts';
import { createPlayback, type Scene } from './playback.ts';
import type { SceneInit, SceneSize, WebGlTier } from './scene.ts';
import type { Insets, ShotName } from './shots.ts';
import { detectTier, isForced } from './tier.ts';
import type { HeroMessage, HeroReply } from './worker.ts';

export type HeroShot = 'edge' | 'field';

export interface HeroHandle {
    setIssued(issuedSats: number, arrived: boolean): void;
    dispose(): void;
}

interface Driver extends Scene {
    resize(size: SceneSize): void;
    setTokens(tokens: TokenState, arrived: boolean): void;
    setTilt(x: number, y: number): void;
}

const WIDE = '(min-width: 40rem) and (min-aspect-ratio: 3/2)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const SHOT_NAMES: readonly ShotName[] = ['edge', 'field', 'token'];

function requestedShot(fallback: HeroShot): ShotName {
    const value = new URLSearchParams(window.location.search).get('shot');
    return SHOT_NAMES.find((shot) => shot === value) ?? fallback;
}

function textInsets(stage: HTMLElement): Insets {
    const text = stage.parentElement?.querySelector<HTMLElement>('.hero__text');
    const height = text?.offsetHeight ?? 0;
    if (window.matchMedia(WIDE).matches) return { top: 0, right: 0, bottom: 0, left: stage.clientWidth * 0.4 };
    return { top: 0, right: 0, bottom: height * 0.72, left: 0 };
}

function measure(stage: HTMLElement): SceneSize {
    return {
        width: stage.clientWidth,
        height: stage.clientHeight,
        pixelRatio: window.devicePixelRatio || 1,
        insets: textInsets(stage),
    };
}

function newCanvas(stage: HTMLElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    return canvas;
}

class SoftwareOnly extends Error {}

// The worker keeps WebGL setup and shader compiles off the main thread, so the page stays responsive.
function workerDriver(canvas: HTMLCanvasElement, init: SceneInit): Promise<Driver> {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const send = (message: HeroMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
    const offscreen = canvas.transferControlToOffscreen();
    return new Promise((resolve, reject) => {
        const fail = (software: boolean) => {
            worker.terminate();
            reject(software ? new SoftwareOnly() : new Error('Hero worker failed'));
        };
        const onError = () => fail(false);
        worker.addEventListener('error', onError, { once: true });
        worker.addEventListener('message', (event: MessageEvent<HeroReply>) => {
            if (event.data.type === 'failed') return fail(event.data.software);
            worker.removeEventListener('error', onError);
            resolve({
                start: () => send({ type: 'play', running: true }),
                stop: () => send({ type: 'play', running: false }),
                resize: (size) => send({ type: 'resize', size }),
                setTokens: (tokens, arrived) => send({ type: 'tokens', tokens, arrived }),
                setTilt: (x, y) => send({ type: 'tilt', x, y }),
                dispose: () => send({ type: 'dispose' }),
            });
        });
        send({ type: 'init', canvas: offscreen, init }, [offscreen]);
    });
}

async function directDriver(canvas: HTMLCanvasElement, init: SceneInit): Promise<Driver> {
    const { createScene } = await import('./scene.ts');
    return createScene(canvas, init);
}

async function startDriver(stage: HTMLElement, init: SceneInit): Promise<[Driver, HTMLCanvasElement]> {
    const canvas = newCanvas(stage);
    if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
        try {
            return [await workerDriver(canvas, init), canvas];
        } catch (error) {
            canvas.remove();
            if (error instanceof SoftwareOnly) throw error;
        }
    }
    const fallback = canvas.isConnected ? canvas : newCanvas(stage);
    try {
        return [await directDriver(fallback, init), fallback];
    } catch (error) {
        fallback.remove();
        throw error;
    }
}

function attach(stage: HTMLElement, driver: Driver, reducedMotion: boolean): () => void {
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', HERO.sceneLabel);
    const playback = createPlayback(driver, !document.hidden);
    const visibility = new IntersectionObserver((entries) => {
        for (const entry of entries) playback.setOnScreen(entry.isIntersecting);
    });
    const resize = new ResizeObserver(() => driver.resize(measure(stage)));
    const onVisibility = () => playback.setPageVisible(!document.hidden);
    const tilt = !reducedMotion && window.matchMedia(FINE_POINTER).matches;
    const onPointer = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        const box = stage.getBoundingClientRect();
        if (event.clientY < box.top || event.clientY > box.bottom) return;
        driver.setTilt(
            ((event.clientX - box.left) / box.width - 0.5) * 2,
            ((event.clientY - box.top) / box.height - 0.5) * -2,
        );
    };
    const onLeave = () => driver.setTilt(0, 0);
    visibility.observe(stage);
    resize.observe(stage);
    document.addEventListener('visibilitychange', onVisibility);
    if (tilt) {
        window.addEventListener('pointermove', onPointer, { passive: true });
        stage.addEventListener('pointerleave', onLeave);
    }
    return () => {
        visibility.disconnect();
        resize.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointermove', onPointer);
        stage.removeEventListener('pointerleave', onLeave);
        playback.dispose();
    };
}

export function mountHero(stage: HTMLElement, shot: HeroShot, issuedSats: number): HeroHandle {
    let tokens: TokenState = tokenState(issuedSats);
    let driver: Driver | null = null;
    let plain: PlainHero | null = null;
    let detach: (() => void) | null = null;
    let disposed = false;

    async function showPlain(): Promise<void> {
        const { renderPlain } = await import('./plain.ts');
        if (disposed) return;
        stage.dataset.tier = 'plain';
        plain = renderPlain(stage, tokens, shot);
    }

    async function showScene(tier: WebGlTier): Promise<void> {
        const reducedMotion = prefersReducedMotion();
        const init: SceneInit = {
            tier,
            allowSoftware: isForced(),
            shot: requestedShot(shot),
            tokens,
            reducedMotion,
            size: measure(stage),
        };
        const [started, canvas] = await startDriver(stage, init);
        if (disposed) {
            started.dispose();
            canvas.remove();
            return;
        }
        stage.dataset.tier = tier;
        driver = started;
        driver.setTokens(tokens, false);
        detach = attach(stage, started, reducedMotion);
        requestAnimationFrame(() => canvas.classList.add('is-ready'));
    }

    async function load(): Promise<void> {
        if (disposed || !stage.isConnected) return;
        const tier = detectTier();
        if (tier === 'plain') return showPlain();
        try {
            await showScene(tier);
        } catch {
            if (!disposed) await showPlain();
        }
    }

    const near = new IntersectionObserver(
        (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            near.disconnect();
            whenIdle(() => void load());
        },
        { rootMargin: '200px 0px' },
    );
    near.observe(stage);

    return {
        setIssued(next, arrived) {
            tokens = tokenState(next);
            driver?.setTokens(tokens, arrived);
            plain?.update(tokens);
        },
        dispose() {
            disposed = true;
            near.disconnect();
            if (detach) detach();
            else driver?.dispose();
            plain?.dispose();
        },
    };
}
