import { type CharRole, emptyLayout, type Ink, inkIndex, type Layout, plotBox, type SceneData } from './types.ts';

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const LEVELS = 8;
const MAX_CHARS = 90;
const PLACEHOLDER = 42;
const ROW_CHOICES = [8, 12, 16, 20, 24, 32, 44];

const ROLE_INK: Record<CharRole, Ink> = {
    hrp: 'fiat',
    prefix: 'fiat',
    separator: 'paper',
    version: 'btc',
    program: 'paper',
    body: 'paper',
    checksum: 'btc',
    unknown: 'ghost',
};

export function charLevels(text: string): number[] {
    const lower = text.toLowerCase();
    const split = lower.lastIndexOf('1');
    const bech32 = /^(bc|tb|bcrt)1/.test(lower) && split > 0;
    return [...text].map((char, i) => {
        if (bech32) {
            if (i < split) return 0.5;
            if (i === split) return 0.15;
            const index = BECH32.indexOf(char.toLowerCase());
            return index < 0 ? -1 : (index + 1) / BECH32.length;
        }
        const index = BASE58.indexOf(char);
        return index < 0 ? -1 : (index + 1) / BASE58.length;
    });
}

export function bech32Roles(text: string): CharRole[] {
    const split = text.lastIndexOf('1');
    return [...text].map((_, i) => {
        if (i < split) return 'hrp';
        if (i === split) return 'separator';
        if (i === split + 1) return 'version';
        return i >= text.length - 6 ? 'checksum' : 'program';
    });
}

function jitter(i: number): number {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x) - 0.5;
}

export function addressLayout(data: SceneData, aspect: number): Layout {
    const address = data.id === 'address' ? data : null;
    const empty = !address || address.state === 'empty' || address.text.length === 0;
    const text = empty ? '' : address.text.slice(0, MAX_CHARS);
    const count = empty ? PLACEHOLDER : text.length;
    const levels = empty ? [] : charLevels(text);
    const roles = address && address.roles.length > 0 ? address.roles : bech32Roles(text);
    const box = plotBox(aspect);
    let best = { perRow: 16, cell: 0 };
    for (const perRow of ROW_CHOICES) {
        const rows = Math.ceil(count / perRow);
        const columns = perRow + Math.ceil(perRow / 4) - 1;
        const cell = Math.min(box.w / columns, box.h / (rows * (LEVELS + 2) - 2));
        if (cell > best.cell) best = { perRow, cell };
    }
    const { perRow, cell } = best;
    const rows = Math.ceil(count / perRow);
    const width = (perRow + Math.ceil(perRow / 4) - 1) * cell;
    const height = (rows * (LEVELS + 2) - 2) * cell;
    const left = box.x + (box.w - width) / 2;
    const top = box.y + (box.h - height) / 2;
    const layout = emptyLayout(count * LEVELS, `address:${perRow}`);
    for (let c = 0; c < count; c += 1) {
        const row = Math.floor(c / perRow);
        const col = c % perRow;
        const x = left + (col + Math.floor(col / 4) + 0.5) * cell;
        const base = top + (row * (LEVELS + 2) + LEVELS - 0.5) * cell;
        const level = levels[c] ?? 0;
        const bad = !empty && (level < 0 || address?.suspect === c);
        const role = roles[c] ?? 'unknown';
        const loose = !empty && address?.checksumBad === true && role === 'checksum';
        const ink: Ink = empty ? 'faint' : bad ? 'ember' : loose ? 'ghost' : ROLE_INK[role];
        const stack = empty ? 1 : bad && level < 0 ? LEVELS : Math.max(1, Math.round(level * LEVELS));
        for (let d = 0; d < LEVELS; d += 1) {
            const i = c * LEVELS + d;
            const shown = d < stack;
            layout.x[i] = x + (loose ? jitter(i) * cell * 0.7 : 0);
            layout.y[i] = base - d * cell - (bad ? cell * 1.2 : 0) + (loose ? jitter(i + 99) * cell * 0.7 : 0);
            layout.ink[i] = inkIndex(shown ? ink : 'faint');
            layout.r[i] = shown ? cell * 0.36 : 0;
        }
    }
    return layout;
}
