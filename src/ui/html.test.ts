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

    it('opens with one headline on the overview plate, every tile a plate, and a print control', () => {
        const markup = renderHome().value;
        expect(markup).toContain('class="overview" aria-labelledby="home-heading" data-plate');
        expect(markup.match(/class="tile" href="[^"]+" data-plate/g)).toHaveLength(TOOL_IDS.length);
        expect(markup).toContain('data-share="print"');
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

    it('renders print, download and post disabled until there is an answer to print', () => {
        const markup = renderToolPage('power').value;
        const buttons = [...markup.matchAll(/<button[^>]*data-share="(print|download)"[^>]*>/g)];
        expect(buttons.map(([, kind]) => kind)).toEqual(['print', 'download']);
        for (const [button] of buttons) expect(button).toContain('disabled');
        expect(markup).toMatch(/<a [^>]*data-share-post[^>]*aria-disabled="true"/);
    });

    it('mounts every gauge as one opaque plate on a still mount, with its details on a plate below', () => {
        for (const id of TOOL_IDS) {
            const markup = renderToolPage(id).value;
            expect(markup).toContain('<div class="mount" data-plate>');
            expect(markup.indexOf('class="gauge"')).toBeGreaterThan(markup.indexOf('class="mount"'));
            expect(markup).toContain('class="tool__below" data-plate');
            expect(markup).toContain(`Gauge 0${TOOL_IDS.indexOf(id) + 1}`);
        }
    });

    it('gives every calculator one scene window: a plot the stage paints, a caption and a callout slot', () => {
        for (const id of ['power', 'convert', 'dca', 'address'] as const) {
            const markup = renderToolPage(id).value;
            expect(markup).toContain('<div id="scene-plot" class="scene__plot" aria-hidden="true"></div>');
            expect(markup).toContain('class="scene__callout"');
        }
    });

    it('puts the scene, a counting figure and an empty numbers panel on the Bitcoin left page', () => {
        const markup = renderToolPage('left').value;
        expect(markup).toContain('id="scene-plot"');
        expect(markup).toContain(`<span class="result__empty">${LEFT_PAGE.figureEmpty}</span>`);
        expect(markup).toContain('id="numbers-panel"');
    });
});
