import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { HERO, TOOLS } from './copy.ts';
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
    it('links every tool once, in order', () => {
        const markup = renderHome().value;
        const hrefs = [...markup.matchAll(/class="tool-row" href="([^"]+)"/g)].map((match) => match[1]);
        expect(hrefs).toEqual(TOOL_IDS.map((id) => `#/${id}`));
        for (const id of TOOL_IDS) {
            expect(markup).toContain(TOOLS[id].question);
            expect(markup).toContain(escapeHtml(TOOLS[id].preview));
        }
    });

    it('reserves the hero stage and figure slot without a number', () => {
        const markup = renderHome().value;
        expect(markup).toContain('id="hero-stage"');
        expect(markup).toContain(
            `id="hero-figure" class="hero__figure"><span class="hero__figure-empty">${HERO.figureEmpty}`,
        );
    });
});

describe('renderToolPage', () => {
    it('gives every calculator the shared frame', () => {
        for (const id of TOOL_IDS.filter((tool) => tool !== 'left')) {
            const markup = renderToolPage(id).value;
            for (const part of ['class="tool__inputs"', 'class="result', 'class="share-bar"', 'class="source-line"']) {
                expect(markup).toContain(part);
            }
            expect(markup).toContain(escapeHtml(TOOLS[id].privacy));
        }
    });

    it('renders share actions disabled until there is an answer to share', () => {
        const buttons = [...renderToolPage('power').value.matchAll(/<button[^>]*data-share[^>]*>/g)];
        expect(buttons).toHaveLength(3);
        for (const [button] of buttons) expect(button).toContain('disabled');
    });

    it('puts the hero and an empty numbers panel on the Bitcoin left page', () => {
        const markup = renderToolPage('left').value;
        expect(markup).toContain('id="hero-stage"');
        expect(markup).toContain('id="numbers-panel"');
    });
});
