import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, TOOLS } from './copy.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';

function renderToolList(): SafeHtml {
    const rows = TOOL_IDS.map(
        (id, index) => html`<li class="tool-list__item">
        <a class="tool-row" href="${hrefFor(id)}">
            <span class="tool-row__name">${TOOLS[id].name}</span>
            <span class="tool-row__question">${TOOLS[id].question}</span>
            <span class="tool-row__preview">${TOOLS[id].preview}</span>
            <span class="tool-row__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            <span class="tool-row__arrow" aria-hidden="true">→</span>
        </a>
    </li>`,
    );
    return html`<section class="tools" aria-labelledby="tools-heading">
    <h2 id="tools-heading" class="home__heading">${HOME.toolsHeading}</h2>
    <ol class="tool-list">${rows}</ol>
</section>`;
}

function renderCautions(): SafeHtml {
    const lines = HOME.cautions.map((line) => html`<li class="cautions__item">${line}</li>`);
    return html`<section class="cautions" aria-labelledby="cautions-heading">
    <h2 id="cautions-heading" class="home__heading">${HOME.cautionsHeading}</h2>
    <ul class="cautions__list">${lines}</ul>
</section>`;
}

export function renderHome(): SafeHtml {
    return html`${renderHero()}
<div class="home">
    ${renderToolList()}
    ${renderCautions()}
</div>`;
}
