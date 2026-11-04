import { GAUGE } from '../ui/copy.ts';
import { gauge, label, labelSize, px, rect, safeView } from './marks.ts';
import type { CharRole, Gauge, Mark, SceneData, Viewport } from './types.ts';

const MAX_CHARS = 90;
const PLACEHOLDER = 42;
const ROW_CHOICES = [8, 12, 16, 20, 24, 32, 44];
/** A character cell is a little taller than wide, like type on a printed label. */
const CELL_RATIO = 1.3;

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Characters that can never appear where they stand: outside the alphabet of the address's own encoding. */
export function foreignChars(text: string): boolean[] {
    const lower = text.toLowerCase();
    const split = lower.lastIndexOf('1');
    const bech32 = /^(bc|tb|bcrt)1/.test(lower) && split > 0;
    return [...text].map((char, i) => {
        if (bech32) return i > split && !BECH32.includes(char.toLowerCase());
        return !BASE58.includes(char);
    });
}

const ROLE_INK: Record<CharRole, string> = {
    hrp: 'cool',
    prefix: 'cool',
    separator: 'dim',
    version: 'dim',
    program: 'ink',
    body: 'ink',
    checksum: 'btc',
    unknown: 'dim',
};

export function bech32Roles(text: string): CharRole[] {
    const split = text.lastIndexOf('1');
    return [...text].map((_, i) => {
        if (i < split) return 'hrp';
        if (i === split) return 'separator';
        if (i === split + 1) return 'version';
        return i >= text.length - 6 ? 'checksum' : 'program';
    });
}

/** A fixed, small offset per cell: a checksum that does not match is drawn loose, never locked. */
function loose(i: number): [number, number] {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12543.123;
    return [(a - Math.floor(a) - 0.5) * 3, (b - Math.floor(b) - 0.5) * 3];
}

/**
 * The address itself, one character per cell in groups of four, coloured by part once the checksum proves the type.
 * A character that cannot belong is inverted in orange; a checksum that does not match leaves its cells loose.
 */
export function addressLayout(data: SceneData, raw: Viewport): Gauge {
    const view = safeView(raw);
    const address = data.id === 'address' ? data : null;
    const empty = !address || address.state === 'empty' || address.text.length === 0;
    const text = empty ? '' : address.text.slice(0, MAX_CHARS);
    const count = empty ? PLACEHOLDER : [...text].length;
    const chars = [...text];
    const foreign = foreignChars(text);
    const roles = address && address.roles.length > 0 ? address.roles : bech32Roles(text);
    const state = empty ? 'empty' : (address?.state ?? 'empty');
    const { width: w, height: h, mini } = view;
    const size = labelSize(view);
    const padTop = mini ? 4 : size * 2.6;
    const boxW = w - 8;
    const boxH = Math.max(1, h - padTop - (mini ? 4 : size));
    let best = { perRow: 16, cell: 0 };
    for (const perRow of ROW_CHOICES) {
        const rows = Math.ceil(count / perRow);
        const columns = perRow + (Math.ceil(perRow / 4) - 1) * 0.5;
        const cell = Math.min(boxW / columns, boxH / (rows * CELL_RATIO + (rows - 1) * 0.35));
        if (cell > best.cell) best = { perRow, cell };
    }
    const { perRow } = best;
    const cell = Math.min(best.cell, 34);
    const rows = Math.ceil(count / perRow);
    const height = cell * CELL_RATIO;
    const gridW = (perRow + (Math.ceil(perRow / 4) - 1) * 0.5) * cell;
    const gridH = rows * height + (rows - 1) * cell * 0.35;
    const left = (w - gridW) / 2;
    const top = padTop + (boxH - gridH) / 2;
    const font = Math.max(7, cell * 0.62);
    const marks: Mark[] = [];
    for (let c = 0; c < count; c += 1) {
        const row = Math.floor(c / perRow);
        const col = c % perRow;
        const x = left + (col + Math.floor(col / 4) * 0.5) * cell;
        const y = top + row * (height + cell * 0.35);
        const role = roles[c] ?? 'unknown';
        const bad = !empty && (address?.suspect === c || foreign[c] === true);
        const unlocked = !empty && address?.checksumBad === true && role === 'checksum';
        const tone = empty ? 'ghost' : bad ? 'bad' : unlocked ? 'loose' : state === 'valid' ? ROLE_INK[role] : 'raw';
        const [dx, dy] = unlocked ? loose(c) : [0, 0];
        const style = `--i: ${c}; transform: translate(${px(dx)}px, ${px(dy)}px)`;
        const solid = mini ? ' g-char--solid' : '';
        marks.push(
            rect(`c${c}`, x + 0.5, y + 0.5, cell - 1.5, height - 1, `g-char g-char--${tone}${solid}`, { style }),
        );
        if (!empty && !mini) {
            marks.push(
                label(
                    `t${c}`,
                    x + (cell - 1) / 2 + dx,
                    y + height * 0.68 + dy,
                    chars[c] ?? '',
                    `g-glyph g-glyph--${tone}`,
                    'middle',
                    {
                        'font-size': px(font),
                        style: `--i: ${c}`,
                    },
                ),
            );
        }
    }
    const kind = !empty && address?.kind ? address.kind : '';
    if (kind && !mini) {
        marks.push(
            label(
                'kind',
                left,
                top - size * 1.1,
                GAUGE.address.stamp(kind, state === 'valid'),
                state === 'valid' ? 'g-label g-label--btc' : 'g-label g-label--ink',
            ),
            ...(gridW >= 330
                ? [label('count', left + gridW, top - size * 1.1, GAUGE.address.count(count), 'g-label', 'end')]
                : []),
        );
    }
    return gauge(view, {
        marks,
        rebuild: `address:${perRow}:${state}`,
        build: state === 'valid' ? 'lock' : 'none',
        className: 'gauge-address',
        summary: `state=${state};chars=${empty ? 0 : count}`,
    });
}
