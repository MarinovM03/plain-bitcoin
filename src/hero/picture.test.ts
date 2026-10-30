import { describe, expect, it } from 'vitest';
import { issued } from '../model/supply.ts';
import { fieldLayout, firstTokenOfEra, tokenState } from './layout.ts';
import { picture } from './picture.ts';
import { plainSvg } from './plain.ts';

describe('picture', () => {
    const layout = fieldLayout();
    const tokens = tokenState(issued(973_854));

    it('marks past eras issued, the current era mixed and later eras unissued', () => {
        const scene = picture(layout, tokens, 'field');
        expect(scene.blocks.slice(0, 6).map((block) => block.state)).toEqual([
            'issued',
            'issued',
            'issued',
            'issued',
            'current',
            'unissued',
        ]);
        expect(scene.blocks[4]?.label).toBe('3.125 BTC');
    });

    it('draws every token of the current era once, plus the partial one', () => {
        const scene = picture(layout, tokens, 'edge');
        const era4 = firstTokenOfEra(4);
        expect(scene.coins).toHaveLength(firstTokenOfEra(5) - era4 - 1);
        expect(scene.coins.filter((coin) => coin.issued)).toHaveLength(tokens.full - era4);
        expect(scene.partial?.fraction).toBe(0.796875);
    });

    it('frames the edge view tighter than the whole field', () => {
        const edge = picture(layout, tokens, 'edge').view;
        const field = picture(layout, tokens, 'field').view;
        expect(edge.w * edge.d).toBeLessThan(field.w * field.d * 0.1);
    });

    it('renders an SVG with the issued and unissued patterns', () => {
        const svg = plainSvg(picture(layout, tokens, 'edge'));
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('url(#pb-issued)');
        expect(svg).toContain('url(#pb-unissued)');
        expect(svg).toContain('3.125 BTC');
    });
});
