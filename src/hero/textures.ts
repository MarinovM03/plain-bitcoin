import { CanvasTexture, SRGBColorSpace } from 'three';
import type { EraBlock, FieldLayout } from './layout.ts';

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function canvas(width: number, height: number): [Surface, Context2D] {
    const element: Surface =
        typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    element.width = width;
    element.height = height;
    const context = element.getContext('2d') as Context2D | null;
    if (!context) throw new Error('2D canvas is not available');
    return [element, context];
}

function texture(source: Surface): CanvasTexture<Surface> {
    const result = new CanvasTexture(source);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
}

export function coinFaceTexture(size = 128): CanvasTexture<Surface> {
    const [element, context] = canvas(size, size);
    const c = size / 2;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    const field = context.createRadialGradient(c, c, 0, c, c, c);
    field.addColorStop(0, '#e9e3da');
    field.addColorStop(0.7, '#f7f3ee');
    field.addColorStop(1, '#ffffff');
    context.fillStyle = field;
    context.fillRect(0, 0, size, size);
    context.lineWidth = 1;
    for (let r = 4; r < c * 0.74; r += 3) {
        context.strokeStyle = `rgba(80, 60, 40, ${0.05 + 0.04 * Math.sin(r * 1.7) ** 2})`;
        context.beginPath();
        context.arc(c, c, r, 0, Math.PI * 2);
        context.stroke();
    }
    context.lineWidth = size * 0.05;
    context.strokeStyle = 'rgba(70, 48, 26, 0.55)';
    context.beginPath();
    context.arc(c, c, c * 0.8, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = size * 0.025;
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.arc(c, c, c * 0.87, 0, Math.PI * 2);
    context.stroke();
    return texture(element);
}

export function glowTexture(size = 128): CanvasTexture<Surface> {
    const [element, context] = canvas(size, size);
    const c = size / 2;
    const glow = context.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.25, 'rgba(255, 255, 255, 0.45)');
    glow.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);
    return texture(element);
}

const SHADOW_RADIUS = 0.68;

export class ContactShadow {
    readonly texture: CanvasTexture<Surface>;
    private readonly context: Context2D;
    private readonly dot: Surface;
    private readonly scale: number;
    private drawn = 0;

    constructor(
        private readonly layout: FieldLayout,
        width: number,
    ) {
        const height = Math.round(width / Math.SQRT2);
        const [element, context] = canvas(width, height);
        this.context = context;
        this.scale = width / layout.width;
        this.texture = texture(element);
        this.dot = this.makeDot();
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        for (const block of layout.blocks) this.terraceShade(block);
    }

    private px(x: number, z: number): [number, number] {
        return [(x + this.layout.width / 2) * this.scale, (z + this.layout.depth / 2) * this.scale];
    }

    private makeDot(): Surface {
        const size = Math.max(4, Math.ceil(SHADOW_RADIUS * 2 * this.scale));
        const [element, context] = canvas(size, size);
        const c = size / 2;
        const shade = context.createRadialGradient(c, c, 0, c, c, c);
        shade.addColorStop(0, 'rgba(20, 14, 8, 0.62)');
        shade.addColorStop(0.55, 'rgba(20, 14, 8, 0.4)');
        shade.addColorStop(1, 'rgba(20, 14, 8, 0)');
        context.fillStyle = shade;
        context.fillRect(0, 0, size, size);
        return element;
    }

    private terraceShade(block: EraBlock): void {
        const [x, y] = this.px(block.x, block.z);
        const w = block.w * this.scale;
        const h = block.d * this.scale;
        if (w < 1 || h < 1) return;
        const context = this.context;
        const away = 10_000;
        context.save();
        context.shadowColor = 'rgba(16, 10, 4, 0.75)';
        context.shadowBlur = Math.max(2, 1.4 * this.scale);
        context.shadowOffsetX = away;
        context.fillStyle = '#000000';
        context.fillRect(x - away, y, w, h);
        context.restore();
        context.fillStyle = '#ffffff';
        context.fillRect(x, y, w, h);
    }

    draw(solid: number): boolean {
        if (solid <= this.drawn) return false;
        const half = this.dot.width / 2;
        for (let i = this.drawn; i < solid; i += 1) {
            const [x, y] = this.px(this.layout.positions[i * 2] ?? 0, this.layout.positions[i * 2 + 1] ?? 0);
            this.context.drawImage(this.dot, x - half, y - half);
        }
        this.drawn = solid;
        this.texture.needsUpdate = true;
        return true;
    }
}
