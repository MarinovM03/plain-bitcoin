import { describe, expect, it } from 'vitest';
import { TOOL_IDS } from '../tools/index.ts';
import { TOOLS } from './copy.ts';
import { renderHome } from './home.ts';
import { html } from './html.ts';

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
        for (const id of TOOL_IDS) expect(markup).toContain(TOOLS[id].question);
    });

    it('reserves the hero mount', () => {
        expect(renderHome().value).toContain('id="hero-canvas"');
    });
});
