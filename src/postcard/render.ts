import { barScale } from '../model/scale.ts';
import { issuedBeforeEra, MAX_SUPPLY, SATS_PER_BTC } from '../model/supply.ts';
import { TOKENS } from '../styles/tokens.ts';
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

/** A bar of supply: issued in ink with a plate-coloured cut at each halving, still-to-mine in orange. */
function supplyBar(context: Context, issued: number, from: number, x: number, y: number, w: number, h: number): void {
    const at = (value: number) => x + ((Math.min(MAX_SUPPLY, Math.max(from, value)) - from) / (MAX_SUPPLY - from)) * w;
    context.fillStyle = TOKENS.ink;
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
    small(context, 'the last 2M, ×10', box.x + box.w, lowY + bar + 24, TOKENS.inkDim, 'right');
    // A card with no as-of date (the link preview) never states a count that will go stale.
    if (undated) return;
    const left = Math.floor((MAX_SUPPLY - issued) / SATS_PER_BTC);
    small(context, `${formatWhole(left)} to mine`, box.x + box.w, lowY - 12, TOKENS.btc, 'right');
}

function drawColumns(context: Context, box: Box, signature: Extract<Signature, { kind: 'columns' }>): void {
    if (!(signature.cash > 0) || !(signature.bitcoin > 0)) return;
    const scale = barScale([signature.cash, signature.bitcoin]);
    const base = box.y + box.h - 30;
    const top = box.y + 30;
    const column = Math.min(110, box.w * 0.3);
    const gap = Math.min(70, box.w * 0.16);
    const left = box.x + (box.w - column * 2 - gap) / 2;
    const parts = [
        { fill: scale.widths[0] ?? 0, colour: TOKENS.inkCool, name: 'Kept as cash', value: signature.cashLabel },
        { fill: scale.widths[1] ?? 0, colour: TOKENS.btc, name: 'As bitcoin', value: signature.bitcoinLabel },
    ];
    parts.forEach((part, i) => {
        const x = left + i * (column + gap);
        const h = Math.max(3, part.fill * (base - top - 24));
        context.fillStyle = TOKENS.well;
        context.fillRect(x, top + 24, column, base - top - 24);
        context.fillStyle = part.colour;
        context.fillRect(x, base - h, column, h);
        small(context, part.value, x + column / 2, base - h - 10, part.colour, 'center');
        small(context, part.name, x + column / 2, base + 24, TOKENS.inkDim, 'center');
    });
    context.fillStyle = TOKENS.inkDim;
    context.fillRect(left - 12, base, column * 2 + gap + 24, 2);
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
    small(context, 'worth', box.x, box.y + 14, TOKENS.btc);
    small(context, 'put in', box.x + 78, box.y + 14, TOKENS.ink);
    small(context, 'lump sum', box.x + 162, box.y + 14, TOKENS.inkCool);
}

function drawStamp(context: Context, box: Box, signature: Extract<Signature, { kind: 'stamp' }>): void {
    const w = Math.min(box.w, 360);
    const h = Math.min(box.h, 220);
    const x = box.x + (box.w - w) / 2;
    const y = box.y + (box.h - h) / 2;
    context.save();
    context.translate(x + w / 2, y + h / 2);
    context.rotate((-3 * Math.PI) / 180);
    context.strokeStyle = TOKENS.btc;
    context.lineWidth = 4;
    context.strokeRect(-w / 2, -h / 2, w, h);
    context.lineWidth = 1.5;
    context.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
    context.textAlign = 'center';
    context.fillStyle = TOKENS.btc;
    context.font = font('display', 46);
    context.fillText(signature.type, 0, -h / 2 + 78);
    context.font = font('mono', 16);
    context.fillText(`${signature.encoding.toUpperCase()} · CHECKSUM VALID`, 0, -h / 2 + 112);
    context.fillStyle = TOKENS.ink;
    const groups = signature.shown.match(/.{1,4}/g) ?? [signature.shown];
    const perLine = signature.shown.includes('…') ? groups.length : 4;
    context.font = font('mono', signature.shown.includes('…') ? 22 : 15);
    for (let row = 0; row * perLine < groups.length && row < 4; row += 1) {
        context.fillText(groups.slice(row * perLine, row * perLine + perLine).join(' '), 0, -h / 2 + 148 + row * 20);
    }
    context.restore();
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
    }
    context.restore();
}

export function drawPostcard(context: Context, card: Postcard, layout: PostcardLayout): void {
    context.fillStyle = TOKENS.plate;
    context.fillRect(0, 0, layout.width, layout.height);
    context.strokeStyle = TOKENS.edge;
    context.lineWidth = 2;
    context.strokeRect(24, 24, layout.width - 48, layout.height - 48);
    context.textBaseline = 'alphabetic';
    text(context, layout.kicker);
    text(context, layout.number);
    for (const line of layout.lines) text(context, line);
    drawSignature(context, layout.signature, card.signature);
    context.fillStyle = TOKENS.edge;
    context.fillRect(layout.rule.x, layout.rule.y, layout.rule.w, layout.rule.h);
    context.fillStyle = TOKENS.btc;
    context.beginPath();
    context.arc(layout.dot.x, layout.dot.y, layout.dot.r, 0, Math.PI * 2);
    context.fill();
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
