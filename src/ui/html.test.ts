import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, LEFT_PAGE, TOOLS } from './copy.ts';
import { renderHome } from './home.ts';
import { escapeHtml, html } from './html.ts';
import { renderMiner } from './miner-view.ts';
import { renderHeader } from './shell.ts';
import { renderToolPage } from './tool-page.ts';

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

    it('keeps the bar to the name, the Machines menu, the live facts and @PlainBTC', () => {
        const markup = renderHeader().value;
        expect(markup).toContain('href="/" data-nav="home"');
        expect(markup).toContain('popovertarget="machines"');
        expect(markup).toContain('id="machines" class="menu" popover');
        for (const id of TOOL_IDS) expect(markup).toContain(`class="menu__link" href="/${id}" data-nav="${id}"`);
        expect(markup).toContain('href="https://x.com/PlainBTC"');
    });
});

describe('renderHome', () => {
    it('links every machine once as a tile with its name, line and one live fact, the miner first', () => {
        const markup = renderHome().value;
        const hrefs = [...markup.matchAll(/class="tile__link" href="([^"]+)"/g)].map((match) => match[1]);
        expect(hrefs[0]).toBe('/miner');
        expect([...hrefs].sort()).toEqual(TOOL_IDS.map((id) => `/${id}`).sort());
        for (const id of TOOL_IDS) {
            expect(markup).toContain(escapeHtml(TOOLS[id].name));
            expect(markup).toContain(escapeHtml(TOOLS[id].description));
            expect(markup).toContain(`data-fact="${id}"`);
        }
    });

    it('opens My stack from both the strip and its own tile', () => {
        const markup = renderHome().value;
        expect(markup).toMatch(/<a class="now__item" href="\/stack">/);
        expect(markup).toContain('data-fact="stack"');
    });

    it('opens with one headline and keeps every scene hidden from assistive tech and out of the tab order', () => {
        const markup = renderHome().value;
        expect(markup.match(/<h1/g)).toHaveLength(1);
        expect(markup.replace(/<[^>]+>/g, '')).toContain(HOME.headline);
        expect(HOME.headline.endsWith(HOME.headlineAccent)).toBe(true);
        const scenes = [...markup.matchAll(/<div class="tile__scene[^"]*"[^>]*>/g)].map(([tag]) => tag);
        expect(scenes).toHaveLength(TOOL_IDS.length);
        for (const tag of scenes) {
            expect(tag).toContain('aria-hidden="true"');
            expect(tag).not.toContain('tabindex');
        }
        expect(markup).not.toContain('style=');
    });
});

describe('renderMiner', () => {
    it('shows the name, the answer and the Start button before the how-it-works steps', () => {
        const markup = renderMiner().value;
        const order = [
            'class="machine__title"',
            'id="miner-best"',
            'id="miner-run"',
            'class="share-bar"',
            'class="steps"',
        ].map((part) => markup.indexOf(part));
        expect(order.every((at) => at >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(markup).toContain('data-machine="miner" aria-hidden="true"');
        expect(markup.match(/class="step"/g)).toHaveLength(5);
    });
});

describe('renderToolPage', () => {
    it('gives every calculator its name, inputs, answer, picture, share and source in that order', () => {
        for (const id of ['power', 'dca', 'address'] as const) {
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

    it('gives a tool page at most an empty, hidden box for its scene, never a canvas', () => {
        for (const id of ['left', 'power', 'convert', 'dca', 'address'] as const) {
            const markup = renderToolPage(id).value;
            expect(markup).not.toContain('<canvas');
            for (const [tag] of markup.matchAll(/<div [^>]*data-machine[^>]*>/g))
                expect(tag).toContain('aria-hidden="true"');
            if (id !== 'convert' && id !== 'left') expect(markup).toContain('class="picture__callout"');
        }
    });

    it('puts the 21 million block, a counting figure, the zoom and an empty numbers panel on the bitcoin-left page', () => {
        const markup = renderToolPage('left').value;
        expect(markup).toContain('data-machine="wall" aria-hidden="true"');
        expect(markup).toContain('id="left-zoom"');
        expect(markup).toContain(`<span class="result__empty">${LEFT_PAGE.figureEmpty}</span>`);
        expect(markup).toContain('id="numbers-panel"');
    });
});
