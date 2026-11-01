import { TOKENS } from '../styles/tokens.ts';
import { type FieldLayout, fieldLayout, TOKEN_COUNT, TOKEN_RADIUS, type TokenState } from './layout.ts';

export interface ArtBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

let cached: FieldLayout | null = null;

export function drawFlatField(context: CanvasRenderingContext2D, box: ArtBox, tokens: TokenState): void {
    cached ??= fieldLayout();
    const layout = cached;
    const scale = Math.min(box.w / layout.width, box.h / layout.depth);
    const left = box.x + (box.w - layout.width * scale) / 2;
    const top = box.y + (box.h - layout.depth * scale) / 2;
    const px = (x: number) => left + (x + layout.width / 2) * scale;
    const pz = (z: number) => top + (z + layout.depth / 2) * scale;
    const r = TOKEN_RADIUS * scale;

    context.save();
    context.fillStyle = TOKENS.raised;
    for (const block of layout.blocks) {
        if (block.w * scale < 0.5) continue;
        context.fillRect(px(block.x), pz(block.z), block.w * scale, block.d * scale);
    }
    context.fillStyle = TOKENS.btc;
    const size = r * 1.8;
    for (let i = 0; i < Math.min(tokens.full, TOKEN_COUNT); i += 1) {
        const x = px(layout.positions[i * 2] ?? 0);
        const z = pz(layout.positions[i * 2 + 1] ?? 0);
        context.fillRect(x - size / 2, z - size / 2, size, size);
    }
    context.strokeStyle = TOKENS.muted;
    context.globalAlpha = 0.55;
    context.lineWidth = Math.max(0.6, r * 0.25);
    context.beginPath();
    for (let i = tokens.full + 1; i < TOKEN_COUNT; i += 1) {
        const x = px(layout.positions[i * 2] ?? 0);
        const z = pz(layout.positions[i * 2 + 1] ?? 0);
        context.moveTo(x + r * 0.85, z);
        context.arc(x, z, r * 0.85, 0, Math.PI * 2);
    }
    context.stroke();
    context.globalAlpha = 1;
    if (tokens.full < TOKEN_COUNT) {
        const x = px(layout.positions[tokens.full * 2] ?? 0);
        const z = pz(layout.positions[tokens.full * 2 + 1] ?? 0);
        context.fillStyle = TOKENS.paper;
        context.beginPath();
        context.moveTo(x, z);
        context.arc(x, z, r * 1.6, -Math.PI / 2, -Math.PI / 2 + tokens.partial * Math.PI * 2);
        context.closePath();
        context.fill();
        context.strokeStyle = TOKENS.paper;
        context.lineWidth = Math.max(1, r * 0.4);
        context.beginPath();
        context.arc(x, z, r * 2.4, 0, Math.PI * 2);
        context.stroke();
    }
    context.restore();
}
