import { SHARE, SITE_NAME } from '../ui/copy.ts';
import type { Postcard, PostcardFormat } from './types.ts';

/** Logical sizes; the PNG is drawn at twice this. 1.91:1 renders uncropped in an X timeline; 1:1 is the square. */
export const FORMATS: Record<PostcardFormat, { width: number; height: number; margin: number }> = {
    wide: { width: 1200, height: 628, margin: 64 },
    square: { width: 1080, height: 1080, margin: 72 },
};
export const EXPORT_SCALE = 2;

export type Measure = (text: string, font: string) => number;

export type Face = 'display' | 'mono';

export interface TextBox {
    text: string;
    x: number;
    /** Baseline. */
    y: number;
    size: number;
    face: Face;
    tone: 'ink' | 'dim' | 'btc';
    align: 'left' | 'right';
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface PostcardLayout {
    width: number;
    height: number;
    margin: number;
    kicker: TextBox;
    number: TextBox;
    lines: TextBox[];
    signature: Box;
    rule: Box;
    dot: { x: number; y: number; r: number };
    brand: TextBox;
    handle: TextBox;
    source: TextBox;
}

export function font(face: Face, size: number): string {
    return face === 'display' ? `600 ${size}px "Fraunces", Georgia, serif` : `500 ${size}px "IBM Plex Mono", monospace`;
}

/**
 * Largest size from `start` down to `min` at which the text fits the width. Text that does not fit even at `min` is
 * scaled down further in proportion, since glyph widths scale with the size: a number never overflows its column.
 */
export function fitSize(measure: Measure, text: string, face: Face, width: number, start: number, min: number): number {
    for (let size = start; size > min; size -= 2) if (measure(text, font(face, size)) <= width) return size;
    const atMin = measure(text, font(face, min));
    return atMin <= width ? min : Math.max(1, Math.floor((min * width) / atMin));
}

export function wrap(measure: Measure, text: string, fontSpec: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure(next, fontSpec) > width) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/** Cuts text at a word to fit, ending in an ellipsis, so a long source line never runs off the card. */
export function clip(measure: Measure, text: string, fontSpec: string, width: number): string {
    if (measure(text, fontSpec) <= width) return text;
    const words = text.split(' ');
    while (words.length > 1) {
        words.pop();
        const shorter = `${words.join(' ')}…`;
        if (measure(shorter, fontSpec) <= width) return shorter;
    }
    return `${text.slice(0, 12)}…`;
}

/**
 * Where everything sits on a postcard. Pure: the same postcard, shape and font metrics always give the same layout.
 * The number takes the largest size that fits its column; the line wraps to at most three lines, shrinking first.
 */
export function layoutPostcard(card: Postcard, format: PostcardFormat, measure: Measure, site: string): PostcardLayout {
    const { width, height, margin } = FORMATS[format];
    const wide = format === 'wide';
    const inner = width - margin * 2;
    const signatureWidth = wide ? 360 : inner;
    const column = wide ? inner - signatureWidth - 48 : inner;
    const kickerSize = wide ? 20 : 22;
    const kicker: TextBox = {
        text: card.kicker.toUpperCase(),
        x: margin,
        y: margin + kickerSize,
        size: kickerSize,
        face: 'mono',
        tone: 'dim',
        align: 'left',
    };
    kicker.text = clip(measure, kicker.text, font('mono', kickerSize), inner);

    const numberSize = fitSize(measure, card.number, 'display', column, wide ? 150 : 190, 40);
    const numberTop = kicker.y + (wide ? 44 : 64);
    const number: TextBox = {
        text: card.number,
        x: margin,
        y: numberTop + numberSize * 0.84,
        size: numberSize,
        face: 'display',
        tone: 'btc',
        align: 'left',
    };

    let lineSize = wide ? 36 : 42;
    let wrapped = wrap(measure, card.line, font('display', lineSize), column);
    while (wrapped.length > 3 && lineSize > 24) {
        lineSize -= 2;
        wrapped = wrap(measure, card.line, font('display', lineSize), column);
    }
    if (wrapped.length > 3)
        wrapped = [
            ...wrapped.slice(0, 2),
            clip(measure, wrapped.slice(2).join(' '), font('display', lineSize), column),
        ];
    const lineGap = lineSize * 1.24;
    const lineTop = number.y + (wide ? 40 : 48);
    const lines = wrapped.map(
        (text, i): TextBox => ({
            text,
            x: margin,
            y: lineTop + lineSize + i * lineGap,
            size: lineSize,
            face: 'display',
            tone: 'ink',
            align: 'left',
        }),
    );

    const railTop = height - margin - 76;
    const rule: Box = { x: margin, y: railTop, w: inner, h: 2 };
    const brandY = railTop + 40;
    const dot = { x: margin + 8, y: brandY - 9, r: 8 };
    const brand: TextBox = {
        text: SITE_NAME,
        x: margin + 26,
        y: brandY,
        size: 28,
        face: 'display',
        tone: 'ink',
        align: 'left',
    };
    const handle: TextBox = {
        text: `${site} · ${SHARE.handle}`,
        x: width - margin,
        y: brandY,
        size: 18,
        face: 'mono',
        tone: 'dim',
        align: 'right',
    };
    const sourceSize = 15;
    const source: TextBox = {
        text: clip(measure, card.source, font('mono', sourceSize), inner),
        x: margin,
        y: railTop + 72,
        size: sourceSize,
        face: 'mono',
        tone: 'dim',
        align: 'left',
    };

    const lastLine = lines.at(-1)?.y ?? number.y;
    const signature: Box = wide
        ? { x: width - margin - signatureWidth, y: numberTop, w: signatureWidth, h: railTop - 36 - numberTop }
        : { x: margin, y: lastLine + 44, w: inner, h: Math.max(80, railTop - 40 - (lastLine + 44)) };

    return { width, height, margin, kicker, number, lines, signature, rule, dot, brand, handle, source };
}
