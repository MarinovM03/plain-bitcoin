import { FACE_CELLS, HASH_BITS, hashBits } from '../chain/hash.ts';
import { TOKENS } from '../styles/tokens.ts';
import type { Field } from './bus.ts';

const DPR_CAP = 1.5;
/** The drift is slow, so 20 frames a second is smooth; a timer between frames keeps the browser idle in between. */
const FRAME_MS = 50;
/** Upward drift in CSS px per second: a square takes about two minutes to cross a phone screen. */
const RISE = 7;
const FLIP_MS = 420;
const ROW_DELAY_MS = 70;
const COLUMN_DELAY_MS = 14;
/** How often the frame count is written to the canvas for checks: not every frame, to leave the DOM alone. */
const REPORT_EVERY = 6;

export interface FieldCell {
    x: number;
    y: number;
    size: number;
}

function seeded(index: number, salt: number): number {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

/**
 * Where bit `index` of the hash stands at `seconds`: a 16 x 16 lattice stretched over the viewport, every column
 * rising at its own pace and wrapping below the bottom edge. Pure, so the still frame and the tests share it.
 */
export function fieldCell(index: number, seconds: number, width: number, height: number): FieldCell {
    const column = index % FACE_CELLS;
    const row = Math.floor(index / FACE_CELLS);
    const cellW = width / FACE_CELLS;
    const cellH = height / (FACE_CELLS - 1);
    const total = cellH * FACE_CELLS;
    const pace = 0.7 + 0.6 * seeded(column, 1);
    const travelled = row * cellH + seeded(column, 2) * cellH - seconds * RISE * pace;
    const wrapped = ((travelled % total) + total) % total;
    const sway = Math.sin(seconds * 0.21 + index * 0.9) * cellW * 0.1;
    return {
        x: (column + 0.5 + (seeded(index, 3) - 0.5) * 0.5) * cellW + sway,
        y: wrapped - cellH * 0.5,
        size: Math.min(13, Math.max(7, Math.min(cellW, cellH) * 0.2)) * (0.75 + 0.5 * seeded(index, 4)),
    };
}

function channels(hex: string): string {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(',');
}

/**
 * The page's moving ground: the 256 bits of the newest block's hash as small squares, set bits in orange, drifting
 * up behind every page. Decoration drawn from one real value; it reads nothing and is never asked anything.
 */
export function runField(): Field {
    const canvas = document.createElement('canvas');
    canvas.id = 'ground';
    canvas.className = 'ground';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const set = channels(TOKENS.btc);
    const unset = channels(TOKENS.inkWarm);
    let shown: Uint8Array = new Uint8Array(HASH_BITS);
    let next: Uint8Array = shown;
    let flipFrom = Number.NEGATIVE_INFINITY;
    let hash: string | null = null;
    let level = 1;
    let width = 0;
    let height = 0;
    let scale = 1;
    let raf = 0;
    let timer = 0;
    let last = 0;
    let seconds = 0;
    let frames = 0;

    document.body.prepend(canvas);

    function size(): void {
        width = window.innerWidth;
        height = window.innerHeight;
        scale = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
    }

    /** One colour per pass and only the alpha changing per square: cheap enough for the weakest phone. */
    function pass(now: number, wanted: boolean): boolean {
        if (!context) return true;
        let settled = true;
        for (let index = 0; index < HASH_BITS; index += 1) {
            const column = index % FACE_CELLS;
            const row = Math.floor(index / FACE_CELLS);
            const since = now - flipFrom - row * ROW_DELAY_MS - column * COLUMN_DELAY_MS;
            const flipped = since >= 0;
            if (!flipped) settled = false;
            if (((flipped ? next : shown)[index] === 1) !== wanted) continue;
            const flash = flipped && since < FLIP_MS ? 1 - since / FLIP_MS : 0;
            const cell = fieldCell(index, seconds, width, height);
            const ripple = 0.72 + 0.28 * Math.sin(seconds * 0.55 + row * 0.5 - column * 0.3);
            const strength = wanted ? 0.62 * ripple + 0.38 * flash : 0.08 * ripple + 0.3 * flash;
            context.globalAlpha = Math.min(1, strength * level);
            context.fillRect(cell.x - cell.size / 2, cell.y - cell.size / 2, cell.size, cell.size);
        }
        return settled;
    }

    function draw(now: number, report: boolean): void {
        if (!context || width < 2 || height < 2) return;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.globalAlpha = 1;
        context.clearRect(0, 0, width, height);
        context.fillStyle = `rgb(${unset})`;
        pass(now, false);
        context.fillStyle = `rgb(${set})`;
        if (pass(now, true)) shown = next;
        frames += 1;
        if (report || frames % REPORT_EVERY === 0) canvas.dataset.frames = String(frames);
    }

    function tick(now: number): void {
        raf = 0;
        if (document.hidden || motion.matches) return;
        seconds += Math.min(0.1, Math.max(0, now - last) / 1000);
        last = now;
        draw(now, false);
        timer = window.setTimeout(() => {
            timer = 0;
            raf = requestAnimationFrame(tick);
        }, FRAME_MS);
    }

    function park(): void {
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        raf = 0;
        timer = 0;
    }

    /** One finished frame: reduced motion, and any change while the loop is parked. */
    function still(): void {
        shown = next;
        flipFrom = Number.NEGATIVE_INFINITY;
        draw(performance.now(), true);
    }

    function wake(): void {
        canvas.dataset.state = motion.matches ? 'still' : 'moving';
        if (motion.matches) {
            park();
            still();
        } else if (document.hidden) {
            park();
        } else if (raf === 0 && timer === 0) {
            last = performance.now();
            raf = requestAnimationFrame(tick);
        }
    }

    const onResize = () => {
        size();
        if (motion.matches) still();
    };
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', wake);
    motion.addEventListener('change', wake);
    size();
    wake();

    return {
        setHash(value) {
            if (value === hash) return;
            const first = hash === null;
            hash = value;
            next = hashBits(value);
            canvas.dataset.bits = String(next.reduce((count, bit) => count + bit, 0));
            if (first || motion.matches) still();
            else flipFrom = performance.now();
        },
        setLevel(value) {
            level = value;
            if (motion.matches) still();
        },
    };
}
