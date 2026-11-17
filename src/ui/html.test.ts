import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, LEFT_PAGE, TOOLS } from './copy.ts';
import { renderHome } from './home.ts';
import { escapeHtml, html } from './html.ts';
import { renderHeader } from './shell.ts';
import { renderToolPage } from './tool-page.ts';
import { renderWorld } from './world.ts';

const BARE_LABELS = ['Left', 'Power', 'Convert', 'DCA', 'Address'];

describe('html', () => {
    it('escapes interpolated text but keeps nested markup', () => {
        const inner = html`<b>${'<i>&"\''}</b>`;
        expect(html`<p>${inner}${[inner]}</p>`.value).toBe(
            '<p><b>&lt;i&gt;&amp;&quot;&#39;</b><b>&lt;i&gt;&amp;&quot;&#39;</b></p>',
        );
    });
});

describe('plain names', () => {
    it('gives every route a short name of two or three words and a one-line subtitle, never a bare label', () => {
        for (const id of TOOL_IDS) {
            const words = TOOLS[id].name.split(' ').length;
            expect(words).toBeGreaterThanOrEqual(2);
            expect(words).toBeLessThanOrEqual(3);
            expect(TOOLS[id].description.length).toBeGreaterThan(20);
            expect(TOOLS[id].description.length).toBeLessThanOrEqual(45);
            expect(BARE_LABELS).not.toContain(TOOLS[id].name);
        }
        expect(new Set(TOOL_IDS.map((id) => TOOLS[id].name)).size).toBe(TOOL_IDS.length);
    });

    it('lists every tool in the menu by its full name, as a plain link', () => {
        const markup = renderHeader().value;
        for (const id of TOOL_IDS) {
            expect(markup).toContain(`href="#/${id}" data-nav="${id}"`);
            expect(markup).toContain(escapeHtml(TOOLS[id].name));
        }
        const linkText = [...markup.matchAll(/<span class="menu__name">([^<]+)<\/span>/g)].map((match) => match[1]);
        for (const label of BARE_LABELS) expect(linkText).not.toContain(label);
    });
});

describe('renderHome', () => {
    it('links every tool once, in order, as a row with its name and description', () => {
        const markup = renderHome().value;
        const hrefs = [...markup.matchAll(/class="tool-row" href="([^"]+)"/g)].map((match) => match[1]);
        expect(hrefs).toEqual(TOOL_IDS.map((id) => `#/${id}`));
        for (const id of TOOL_IDS) {
            expect(markup).toContain(escapeHtml(TOOLS[id].name));
            expect(markup).toContain(escapeHtml(TOOLS[id].description));
            expect(markup).toContain(`data-fact="${id}"`);
        }
        expect(markup.match(/class="tool-row__unit">[^<]+</g)).toHaveLength(TOOL_IDS.length);
    });

    it('opens with one headline, and keeps the world behind the page hidden from assistive tech with words beside it', () => {
        const markup = renderHome().value;
        expect(markup.match(/<h1/g)).toHaveLength(1);
        expect(markup.replace(/<[^>]+>/g, '')).toContain(HOME.headline);
        expect(HOME.headline.endsWith(HOME.headlineAccent)).toBe(true);
        expect(markup).not.toContain('id="chain"');
        expect(renderWorld().value).toContain('id="chain" class="world" data-hero="still" aria-hidden="true"');
        expect(renderWorld().value).not.toMatch(/<a |<button|tabindex/);
        expect(markup).toContain('id="chain-forming"');
        expect(markup).toContain('id="chain-rows"');
        expect(markup).toContain('data-share="print"');
        for (const gone of ['data-tile', 'scene', 'data-plate']) expect(markup).not.toContain(gone);
    });
});

describe('renderToolPage', () => {
    it('gives every calculator its name, inputs, answer, picture, share and source in that order', () => {
        for (const id of TOOL_IDS.filter((tool) => tool !== 'left' && tool !== 'convert')) {
            const markup = renderToolPage(id).value;
            const order = [
                'class="tool__title"',
                'class="tool__inputs"',
                'class="result"',
                'id="picture-plot"',
                'class="share-bar"',
                'class="tool__source"',
            ].map((part) => markup.indexOf(part));
            expect(order.every((at) => at >= 0)).toBe(true);
            expect([...order].sort((a, b) => a - b)).toEqual(order);
            expect(markup).toContain(escapeHtml(TOOLS[id].name));
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

    it('leaves nothing of the 3D scenes on any tool page', () => {
        for (const id of TOOL_IDS) {
            const markup = renderToolPage(id).value;
            for (const gone of ['scene', 'data-plate', 'canvas', 'hero']) expect(markup).not.toContain(gone);
            if (id !== 'convert') expect(markup).toContain('class="picture__callout"');
        }
    });

    it('puts the picture, a counting figure and an empty numbers panel on the bitcoin-left page', () => {
        const markup = renderToolPage('left').value;
        expect(markup).toContain('id="picture-plot"');
        expect(markup).toContain(`<span class="result__empty">${LEFT_PAGE.figureEmpty}</span>`);
        expect(markup).toContain('id="numbers-panel"');
    });
});
