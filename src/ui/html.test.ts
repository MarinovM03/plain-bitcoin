import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, LEFT_PAGE, TOOLS } from './copy.ts';
import { renderHome } from './home.ts';
import { escapeHtml, html } from './html.ts';
import { renderToolPage } from './tool-page.ts';

describe('html', () => {
    it('escapes interpolated text but keeps nested markup', () => {
        const inner = html`<b>${'<i>&"\''}</b>`;
        expect(html`<p>${inner}${[inner]}</p>`.value).toBe(
            '<p><b>&lt;i&gt;&amp;&quot;&#39;</b><b>&lt;i&gt;&amp;&quot;&#39;</b></p>',
        );
    });
});

describe('renderHome', () => {
    it('links every tool once, in order, each tile with a preview slot', () => {
        const markup = renderHome().value;
        const hrefs = [...markup.matchAll(/class="tile" href="([^"]+)"/g)].map((match) => match[1]);
        expect(hrefs).toEqual(TOOL_IDS.map((id) => `#/${id}`));
        for (const id of TOOL_IDS) {
            expect(markup).toContain(`data-preview="${id}"`);
            expect(markup).toContain(TOOLS[id].question);
            expect(markup).toContain(escapeHtml(TOOLS[id].preview));
        }
    });

    it('opens with one headline and no hero stage', () => {
        const markup = renderHome().value;
        expect(markup.match(/<h1/g)).toHaveLength(1);
        expect(markup).toContain(HOME.headline);
        expect(markup).not.toContain('hero');
    });
});

describe('renderToolPage', () => {
    it('gives every calculator the scene, inputs, answer, share and source in that order', () => {
        for (const id of TOOL_IDS.filter((tool) => tool !== 'left')) {
            const markup = renderToolPage(id).value;
            const order = [
                'class="tool__title"',
                'id="scene-plot"',
                'class="tool__panel tool__inputs"',
                'class="result"',
                'class="share-bar"',
                'class="tool__source"',
            ].map((part) => markup.indexOf(part));
            expect(order.every((at) => at >= 0)).toBe(true);
            expect([...order].sort((a, b) => a - b)).toEqual(order);
            for (const gone of ['eyebrow', 'tool__dock', 'hero']) expect(markup).not.toContain(gone);
            expect(markup).toContain(escapeHtml(TOOLS[id].privacy));
        }
    });

    it('renders share actions disabled until there is an answer to share', () => {
        const buttons = [...renderToolPage('power').value.matchAll(/<button[^>]*data-share[^>]*>/g)];
        expect(buttons).toHaveLength(3);
        for (const [button] of buttons) expect(button).toContain('disabled');
    });

    it('keeps the DCA chart as a real SVG in the scene, with the lump-sum line', () => {
        const markup = renderToolPage('dca').value;
        expect(markup).toContain('data-still="own"');
        expect(markup).toContain('dca-chart__line--lump');
    });

    it('puts the scene, a counting figure and an empty numbers panel on the Bitcoin left page', () => {
        const markup = renderToolPage('left').value;
        expect(markup).toContain('id="scene-plot"');
        expect(markup).toContain(`<span class="result__empty">${LEFT_PAGE.figureEmpty}</span>`);
        expect(markup).toContain('id="numbers-panel"');
    });
});
