import { barScale } from '../model/scale.ts';
import { issuedBeforeEra, MAX_SUPPLY, SATS_PER_BTC } from '../model/supply.ts';
import { TOKENS } from '../styles/tokens.ts';
import { DCA } from '../ui/copy.ts';
import { formatWhole } from '../util/format.ts';
import { GRID_DOTS, satsScale } from '../util/sats-scale.ts';
import { type Box, EXPORT_SCALE, font, layoutPostcard, type PostcardLayout, type TextBox } from './layout.ts';
import type { Postcard, PostcardFormat, Signature } from './types.ts';

type Context = CanvasRenderingContext2D;

const TONES: Record<TextBox['tone'], string> = { ink: TOKENS.ink, dim: TOKENS.inkDim, btc: TOKENS.btc };
const ZOOM = 2_000_000 * SATS_PER_BTC;

function text(context: Context, box: TextBox): void {
    context.font = font(box.face, box.size);
    context.fillStyle = TONES[box.tone];
    context.textAlign = box.align;
    context.fillText(box.text, box.x, box.y);
}

function small(
    context: Context,
    value: string,
    x: number,
    y: number,
    colour: string = TOKENS.inkDim,
    align: CanvasTextAlign = 'left',
): void {
    context.font = font('mono', 15);
    context.fillStyle = colour;
    context.textAlign = align;
    context.fillText(value, x, y);
}

/** The supply as a bar: issued in bone with a plate-coloured cut at each halving, still-to-mine in orange. */
function supplyBar(context: Context, issued: number, from: number, x: number, y: number, w: number, h: number): void {
    const at = (value: number) => x + ((Math.min(MAX_SUPPLY, Math.max(from, value)) - from) / (MAX_SUPPLY - from)) * w;
    context.fillStyle = TOKENS.inkWarm;
    context.fillRect(x, y, at(issued) - x, h);
    context.fillStyle = TOKENS.btc;
    context.fillRect(at(issued), y, x + w - at(issued), h);
    context.fillStyle = TOKENS.plate;
    for (let era = 1; era <= 8; era += 1) {
        const edge = issuedBeforeEra(era);
        if (edge > from) context.fillRect(at(edge) - 1, y, 2, h);
    }
}

function drawSupply(context: Context, box: Box, issued: number, undated: boolean): void {
    const bar = Math.min(48, box.h * 0.16);
    const topY = box.y + 28;
    const lowY = box.y + box.h - bar - 30;
    supplyBar(context, issued, 0, box.x, topY, box.w, bar);
    supplyBar(context, issued, MAX_SUPPLY - ZOOM, box.x, lowY, box.w, bar);
    context.strokeStyle = TOKENS.edge;
    context.lineWidth = 2;
    context.beginPath();
    const zoomFrom = box.x + ((MAX_SUPPLY - ZOOM) / MAX_SUPPLY) * box.w;
    context.moveTo(zoomFrom, topY + bar);
    context.lineTo(box.x, lowY);
    context.moveTo(box.x + box.w, topY + bar);
    context.lineTo(box.x + box.w, lowY);
    context.stroke();
    small(context, '0', box.x, topY - 10);
    small(context, '21,000,000 BTC', box.x + box.w, topY - 10, TOKENS.inkDim, 'right');
    small(context, '19M', box.x, lowY + bar + 24);
    small(context, 'the last 2M, ×10.5', box.x + box.w, lowY + bar + 24, TOKENS.inkDim, 'right');
    // A card with no as-of date (the link preview) never states a count that will go stale.
    if (undated) return;
    const left = Math.floor((MAX_SUPPLY - issued) / SATS_PER_BTC);
    small(context, `${formatWhole(left)} to mine`, box.x + box.w, lowY - 12, TOKENS.btc, 'right');
}

/** Two plain columns on one baseline: kept as cash in steel, put into bitcoin in orange, on the page's own scale. */
function drawColumns(context: Context, box: Box, signature: Extract<Signature, { kind: 'columns' }>): void {
    if (!(signature.cash > 0) || !(signature.bitcoin > 0)) return;
    const scale = barScale([signature.cash, signature.bitcoin]);
    const base = box.y + box.h - 58;
    const tallest = base - (box.y + 30);
    const width = Math.min(120, box.w * 0.3);
    const gap = Math.min(64, box.w * 0.14);
    const left = box.x + (box.w - width * 2 - gap) / 2;
    const sides = [
        { fill: scale.widths[0] ?? 0, colour: TOKENS.inkCool, value: signature.cashLabel, name: 'Kept as cash' },
        { fill: scale.widths[1] ?? 0, colour: TOKENS.btc, value: signature.bitcoinLabel, name: 'As bitcoin' },
    ];
    sides.forEach((side, index) => {
        const x = left + index * (width + gap);
        const height = Math.max(4, tallest * side.fill);
        context.fillStyle = side.colour;
        context.fillRect(x, base - height, width, height);
        small(context, side.value, x + width / 2, base - height - 10, side.colour, 'center');
        small(context, side.name, x + width / 2, base + 26, TOKENS.inkDim, 'center');
    });
    context.fillStyle = TOKENS.inkDim;
    context.fillRect(box.x, base, box.w, 2);
    if (scale.log) small(context, 'log scale', box.x + box.w, box.y + 14, TOKENS.inkDim, 'right');
}

function drawCells(context: Context, box: Box, sats: number): void {
    const scale = satsScale(sats);
    const across = box.w / box.h > 1.6 ? 5 : 2;
    const down = 10 / across;
    const cell = Math.min(box.w / (across * 11 - 1), (box.h - 40) / (down * 11 - 1));
    const gridW = (across * 11 - 1) * cell;
    const left = box.x + (box.w - gridW) / 2;
    const top = box.y + 30;
    const square = Math.max(1, cell * 0.84);
    for (let i = 0; i < GRID_DOTS; i += 1) {
        const block = Math.floor(i / 100);
        const inBlock = i % 100;
        const x = left + ((block % across) * 11 + (inBlock % 10)) * cell;
        const y = top + (Math.floor(block / across) * 11 + Math.floor(inBlock / 10)) * cell;
        context.fillStyle = i < scale.filled ? TOKENS.btc : TOKENS.well;
        context.fillRect(x, y, square, square);
        if (i === scale.filled && scale.partial > 0) {
            context.fillStyle = TOKENS.btc;
            context.fillRect(x, y + square * (1 - scale.partial), square, square * scale.partial);
        }
    }
    const unit = scale.perDot === 1 ? '1 sat' : `${formatWhole(scale.perDot)} sats`;
    small(context, `1 cell = ${unit}`, left, top - 12, TOKENS.btc);
}

function drawLines(context: Context, box: Box, signature: Extract<Signature, { kind: 'lines' }>): void {
    const length = Math.min(
        signature.t.length,
        signature.value.length,
        signature.invested.length,
        signature.lump.length,
    );
    if (length < 2) return;
    const t0 = signature.t[0] ?? 0;
    const t1 = signature.t[length - 1] ?? t0 + 1;
    let max = 1;
    for (let i = 0; i < length; i += 1)
        max = Math.max(max, signature.value[i] ?? 0, signature.invested[i] ?? 0, signature.lump[i] ?? 0);
    const top = box.y + 34;
    const base = box.y + box.h - 8;
    const x = (t: number) => box.x + ((t - t0) / Math.max(1, t1 - t0)) * box.w;
    const y = (value: number) => base - (Math.max(0, value) / max) * (base - top);
    const step = Math.max(1, Math.floor(length / 400));
    const series: [readonly number[], string, number, number[]][] = [
        [signature.lump, TOKENS.inkCool, 3, [10, 8]],
        [signature.invested, TOKENS.ink, 2.5, []],
        [signature.value, TOKENS.btc, 5, []],
    ];
    context.lineJoin = 'round';
    for (const [values, colour, width, dash] of series) {
        context.strokeStyle = colour;
        context.lineWidth = width;
        context.setLineDash(dash);
        context.beginPath();
        for (let i = 0; i < length; i += step) {
            const px = x(signature.t[i] ?? t0);
            const py = y(values[i] ?? 0);
            if (i === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        }
        context.lineTo(x(signature.t[length - 1] ?? t1), y(values[length - 1] ?? 0));
        context.stroke();
    }
    context.setLineDash([]);
    context.fillStyle = TOKENS.inkDim;
    context.fillRect(box.x, base, box.w, 2);
    context.fillStyle = TOKENS.btc;
    context.beginPath();
    context.arc(x(signature.t[length - 1] ?? t1), y(signature.value[length - 1] ?? 0), 7, 0, Math.PI * 2);
    context.fill();
    let keyX = box.x;
    for (const [key, colour] of [
        ['value', TOKENS.btc],
        ['invested', TOKENS.ink],
        ['lump', TOKENS.inkCool],
    ] as const) {
        small(context, DCA.cardKey[key], keyX, box.y + 14, colour);
        keyX += context.measureText(DCA.cardKey[key]).width + 28;
    }
}

/** The address as the page draws it: its type, then one cell per character the postcard is allowed to show. */
function drawStamp(context: Context, box: Box, signature: Extract<Signature, { kind: 'stamp' }>): void {
    const chars = [...signature.shown];
    const cell = Math.min(34, box.w / Math.max(9, chars.length));
    const rowW = cell * chars.length;
    const x = box.x + (box.w - rowW) / 2;
    const cy = box.y + box.h * 0.52;
    context.textAlign = 'center';
    context.fillStyle = TOKENS.btc;
    context.font = font('display', 44);
    context.fillText(signature.type, box.x + box.w / 2, cy - 44);
    chars.forEach((char, index) => {
        const masked = char === '…';
        context.fillStyle = masked ? TOKENS.plate : TOKENS.well;
        context.fillRect(x + index * cell + 2, cy, cell - 4, cell * 1.25);
        context.fillStyle = masked ? TOKENS.inkDim : TOKENS.ink;
        context.font = font('mono', Math.round(cell * 0.62));
        context.fillText(char, x + index * cell + cell / 2, cy + cell * 0.86);
    });
    small(
        context,
        `${signature.encoding} · checksum valid`,
        box.x + box.w / 2,
        cy + cell * 1.25 + 34,
        TOKENS.btc,
        'center',
    );
}

/** The well from the miner's page: one ring per zero bit, the best hash in white and the target in orange. */
function drawWell(context: Context, box: Box, signature: Extract<Signature, { kind: 'well' }>): void {
    const floor = Math.max(signature.needed, signature.best) + 2;
    const cx = box.x + box.w / 2;
    const top = box.y + 14;
    const depth = box.h - 40;
    for (let level = 0; level <= floor; level += 1) {
        const t = level / floor;
        const y = top + (1 - (1 - t) ** 1.6) * depth;
        const rx = (box.w / 2) * (1 - t * 0.78);
        const ry = rx * 0.16;
        const target = level === signature.needed;
        const best = signature.best >= 0 && level === signature.best;
        if (!target && !best && level % 4 !== 0) continue;
        context.strokeStyle = target ? TOKENS.btc : best ? TOKENS.ink : TOKENS.edge;
        context.lineWidth = target || best ? 3 : 1.5;
        context.beginPath();
        context.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
        context.stroke();
        if (target) small(context, `target · ${signature.needed} zero bits`, cx + rx + 12, y + 5, TOKENS.btc);
        if (best) small(context, `best · ${signature.best}`, cx - rx - 12, y + 5, TOKENS.ink, 'right');
    }
}

/** The waiting line from the transaction page: one bar per projected block, the followed one in orange. */
function drawQueue(context: Context, box: Box, signature: Extract<Signature, { kind: 'queue' }>): void {
    const floors = signature.floors.slice(0, 8);
    if (floors.length === 0) return;
    const top = Math.log(1 + Math.max(2, ...floors));
    const gap = 14;
    const width = (box.w - gap * (floors.length - 1)) / floors.length;
    const base = box.y + box.h - 34;
    floors.forEach((floor, index) => {
        const h = Math.max(6, (Math.log(1 + floor) / top) * (box.h - 70));
        const x = box.x + index * (width + gap);
        context.fillStyle = signature.slab === index + 1 ? TOKENS.btc : TOKENS.edge;
        context.fillRect(x, base - h, width, h);
        small(context, `+${index + 1}`, x + width / 2, base + 24, TOKENS.inkDim, 'center');
    });
    const label =
        signature.slab === 0
            ? 'confirmed'
            : signature.slab === null
              ? 'waiting behind these blocks'
              : `in block +${signature.slab}`;
    small(context, `next blocks by lowest fee · mine: ${label}`, box.x, box.y + 14, TOKENS.btc);
}

function drawSignature(context: Context, box: Box, signature: Signature): void {
    context.save();
    context.beginPath();
    context.rect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
    context.clip();
    switch (signature.kind) {
        case 'supply':
            drawSupply(context, box, signature.issued, signature.undated === true);
            break;
        case 'columns':
            drawColumns(context, box, signature);
            break;
        case 'cells':
            drawCells(context, box, signature.sats);
            break;
        case 'lines':
            drawLines(context, box, signature);
            break;
        case 'stamp':
            drawStamp(context, box, signature);
            break;
        case 'well':
            drawWell(context, box, signature);
            break;
        case 'queue':
            drawQueue(context, box, signature);
            break;
        case 'blank':
            break;
    }
    context.restore();
}

export function drawPostcard(context: Context, card: Postcard, layout: PostcardLayout): void {
    context.fillStyle = TOKENS.plate;
    context.fillRect(0, 0, layout.width, layout.height);
    context.textBaseline = 'alphabetic';
    text(context, layout.kicker);
    text(context, layout.number);
    for (const line of layout.lines) text(context, line);
    drawSignature(context, layout.signature, card.signature);
    context.fillStyle = TOKENS.edge;
    context.fillRect(layout.rule.x, layout.rule.y, layout.rule.w, layout.rule.h);
    context.fillStyle = TOKENS.btc;
    context.fillRect(layout.dot.x - layout.dot.r, layout.dot.y - layout.dot.r, layout.dot.r * 2, layout.dot.r * 2);
    text(context, layout.brand);
    text(context, layout.handle);
    text(context, layout.source);
}

async function fontsReady(): Promise<void> {
    if (!document.fonts) return;
    await Promise.all([document.fonts.load(font('display', 40)), document.fonts.load(font('mono', 20))]);
    await document.fonts.ready;
}

/** Draws a postcard into a canvas of its own, at twice its logical size. Self-hosted fonts only; nothing is fetched. */
export async function renderPostcard(
    card: Postcard,
    format: PostcardFormat,
    site: string,
    scale = EXPORT_SCALE,
    canvas: HTMLCanvasElement = document.createElement('canvas'),
): Promise<{ canvas: HTMLCanvasElement; layout: PostcardLayout }> {
    await fontsReady();
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is not available');
    const layout = layoutPostcard(
        card,
        format,
        (value, spec) => {
            context.font = spec;
            return context.measureText(value).width;
        },
        site,
    );
    canvas.width = layout.width * scale;
    canvas.height = layout.height * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    drawPostcard(context, card, layout);
    canvas.dataset.number = layout.number.text;
    canvas.dataset.format = format;
    return { canvas, layout };
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Postcard export failed'))), 'image/png');
    });
}
