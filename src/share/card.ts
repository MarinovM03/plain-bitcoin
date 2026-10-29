import { TOKENS } from '../styles/tokens.ts';
import { SHARE, SITE_NAME } from '../ui/copy.ts';
import type { ShareCard } from './index.ts';

export type CardShape = 'wide' | 'tall';

interface Layout {
    width: number;
    height: number;
    pad: number;
    wordmark: number;
    headline: number;
    minHeadline: number;
    maxLines: number;
    detail: number;
    small: number;
}

export const CARD_LAYOUTS: Record<CardShape, Layout> = {
    wide: {
        width: 1200,
        height: 675,
        pad: 72,
        wordmark: 40,
        headline: 64,
        minHeadline: 40,
        maxLines: 3,
        detail: 32,
        small: 22,
    },
    tall: {
        width: 1080,
        height: 1350,
        pad: 88,
        wordmark: 52,
        headline: 84,
        minHeadline: 52,
        maxLines: 6,
        detail: 42,
        small: 27,
    },
};

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function fitHeadline(context: CanvasRenderingContext2D, text: string, layout: Layout, maxWidth: number) {
    let size = layout.headline;
    for (;;) {
        context.font = `500 ${size}px ${TOKENS.fontMono}`;
        const lines = wrap(context, text, maxWidth);
        if (lines.length <= layout.maxLines || size <= layout.minHeadline) return { size, lines };
        size -= 2;
    }
}

async function fontsReady(layout: Layout): Promise<void> {
    await Promise.all([
        document.fonts.load(`600 ${layout.wordmark}px ${TOKENS.fontDisplay}`),
        document.fonts.load(`500 ${layout.headline}px ${TOKENS.fontMono}`),
    ]);
    await document.fonts.ready;
}

function draw(context: CanvasRenderingContext2D, card: ShareCard, layout: Layout, site: string): void {
    const { width, height, pad } = layout;
    const inner = width - pad * 2;
    context.fillStyle = TOKENS.ink;
    context.fillRect(0, 0, width, height);
    context.textBaseline = 'alphabetic';

    const dot = layout.wordmark * 0.16;
    context.fillStyle = TOKENS.btc;
    context.beginPath();
    context.arc(pad + dot, pad + layout.wordmark * 0.62, dot, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = TOKENS.paper;
    context.font = `600 ${layout.wordmark}px ${TOKENS.fontDisplay}`;
    context.fillText(SITE_NAME, pad + dot * 2 + layout.wordmark * 0.3, pad + layout.wordmark * 0.9);

    const footerTop = height - pad - layout.small * 2.9;
    const headline = fitHeadline(context, card.headline, layout, inner);
    const lineHeight = headline.size * 1.2;
    context.font = `400 ${layout.detail}px ${TOKENS.fontBody}`;
    const detailLines = wrap(context, card.detail, inner);
    const detailHeight = detailLines.length * layout.detail * 1.35;
    const blockHeight = headline.lines.length * lineHeight + layout.detail * 0.9 + detailHeight;
    const top = pad + layout.wordmark * 1.4;
    let y = top + Math.max(0, (footerTop - top - blockHeight) / 2);

    context.fillStyle = TOKENS.paper;
    context.font = `500 ${headline.size}px ${TOKENS.fontMono}`;
    for (const line of headline.lines) {
        y += lineHeight;
        context.fillText(line, pad, y - headline.size * 0.25);
    }
    y += layout.detail * 0.9;
    context.fillStyle = TOKENS.btc;
    context.font = `400 ${layout.detail}px ${TOKENS.fontBody}`;
    for (const line of detailLines) {
        y += layout.detail * 1.35;
        context.fillText(line, pad, y - layout.detail * 0.3);
    }

    context.fillStyle = TOKENS.line;
    context.fillRect(pad, footerTop, inner, 2);
    context.font = `400 ${layout.small}px ${TOKENS.fontBody}`;
    context.fillStyle = TOKENS.muted;
    context.fillText(card.source, pad, footerTop + layout.small * 1.6, inner);
    context.fillStyle = TOKENS.paper;
    context.fillText(`${SHARE.handle} · ${site}`, pad, footerTop + layout.small * 2.9, inner);
}

export async function renderCard(card: ShareCard, shape: CardShape, site: string): Promise<Blob> {
    const layout = CARD_LAYOUTS[shape];
    await fontsReady(layout);
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is not available');
    draw(context, card, layout, site);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Card export failed'))), 'image/png');
    });
}
