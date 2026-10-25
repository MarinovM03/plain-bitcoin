import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, TOOLS } from './copy.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';

function renderToolList(): SafeHtml {
    const rows = TOOL_IDS.map(
        (id) => html`<li>
        <a class="tool-row" href="${hrefFor(id)}">
            <span class="tool-row__name">${TOOLS[id].name}</span>
            <span class="tool-row__question">${TOOLS[id].question}</span>
            <span class="tool-row__preview">${TOOLS[id].preview}</span>
            <span class="tool-row__arrow" aria-hidden="true">→</span>
        </a>
    </li>`,
    );
    return html`<section class="tools" aria-labelledby="tools-heading">
    <h2 id="tools-heading" class="tools__heading">${HOME.toolsHeading}</h2>
    <ul class="tool-list">${rows}</ul>
</section>`;
}

export function renderHome(): SafeHtml {
    return html`${renderHero()}
<p class="promise">${HOME.promise}</p>
${renderToolList()}`;
}
