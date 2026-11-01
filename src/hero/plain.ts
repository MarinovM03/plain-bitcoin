import { TOKENS } from '../styles/tokens.ts';
import { fieldLayout, TOKEN_RADIUS, type TokenState } from './layout.ts';
import { type Picture, type PictureView, picture } from './picture.ts';

const SVG = 'http://www.w3.org/2000/svg';

const n = (value: number) => Number(value.toFixed(3));

function pie(x: number, z: number, r: number, fraction: number): string {
    if (fraction <= 0) return '';
    if (fraction >= 1) return `M${n(x - r)} ${n(z)}a${r} ${r} 0 1 0 ${n(r * 2)} 0a${r} ${r} 0 1 0 ${n(-r * 2)} 0Z`;
    const angle = fraction * Math.PI * 2;
    const ex = x + r * Math.sin(angle);
    const ez = z - r * Math.cos(angle);
    return `M${n(x)} ${n(z)}L${n(x)} ${n(z - r)}A${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${n(ex)} ${n(ez)}Z`;
}

export function plainSvg(scene: Picture): string {
    const { view } = scene;
    const r = TOKEN_RADIUS;
    const parts: string[] = [
        `<svg xmlns="${SVG}" viewBox="${n(view.x)} ${n(view.z)} ${n(view.w)} ${n(view.d)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">`,
        '<defs>',
        `<pattern id="pb-issued" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="${r}" fill="${TOKENS.btc}"/></pattern>`,
        `<pattern id="pb-unissued" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="${r * 0.9}" fill="none" stroke="${TOKENS.paper}" stroke-opacity="0.3" stroke-width="0.08"/></pattern>`,
        '</defs>',
    ];
    for (const block of scene.blocks) {
        const rect = `x="${n(block.x)}" y="${n(block.z)}" width="${n(block.w)}" height="${n(block.d)}"`;
        parts.push(`<rect ${rect} fill="${TOKENS.line}" fill-opacity="0.55"/>`);
        if (block.state !== 'current') {
            const opacity = block.state === 'issued' ? ` fill-opacity="${n(0.55 + Math.min(block.era, 4) * 0.1)}"` : '';
            parts.push(`<rect ${rect} fill="url(#pb-${block.state})"${opacity}/>`);
        }
    }
    for (const coin of scene.coins) {
        parts.push(
            coin.issued
                ? `<circle cx="${n(coin.x)}" cy="${n(coin.z)}" r="${r}" fill="${TOKENS.btc}"/>`
                : `<circle cx="${n(coin.x)}" cy="${n(coin.z)}" r="${r * 0.9}" fill="none" stroke="${TOKENS.paper}" stroke-opacity="0.3" stroke-width="0.08"/>`,
        );
    }
    if (scene.partial) {
        const { x, z, fraction } = scene.partial;
        parts.push(
            `<circle cx="${n(x)}" cy="${n(z)}" r="${r * 1.25}" fill="none" stroke="${TOKENS.btc}" stroke-width="0.09"/>`,
            `<circle cx="${n(x)}" cy="${n(z)}" r="${r * 0.9}" fill="none" stroke="${TOKENS.paper}" stroke-opacity="0.5" stroke-width="0.08"/>`,
            `<path d="${pie(x, z, r, fraction)}" fill="${TOKENS.btc}"/>`,
        );
    }
    for (const block of scene.blocks) {
        const size = Math.min(block.w, block.d) * 0.11;
        if (size < view.w * 0.012 || block.w < size * 6) continue;
        parts.push(
            `<text x="${n(block.x + block.w / 2)}" y="${n(block.z + block.d / 2 + size * 0.35)}" font-size="${n(size)}" text-anchor="middle" fill="${TOKENS.paper}" stroke="${TOKENS.raised}" stroke-width="${n(size * 0.28)}" paint-order="stroke" font-family="${TOKENS.fontMono.replace(/"/g, "'")}">${block.label}</text>`,
        );
    }
    parts.push('</svg>');
    return parts.join('');
}

export interface PlainHero {
    update(tokens: TokenState): void;
    dispose(): void;
}

export function renderPlain(stage: HTMLElement, tokens: TokenState, view: PictureView): PlainHero {
    const layout = fieldLayout();
    const holder = document.createElement('div');
    holder.className = 'hero__plain';
    const draw = (next: TokenState) => {
        holder.innerHTML = plainSvg(picture(layout, next, view));
    };
    draw(tokens);
    stage.append(holder);
    return {
        update: draw,
        dispose: () => holder.remove(),
    };
}
