import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { HERO, HOME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

function renderHero(): SafeHtml {
    return html`<section class="hero" aria-labelledby="hero-heading">
    <div id="hero-canvas" class="hero__canvas" aria-hidden="true"></div>
    <div class="hero__text">
        <h1 id="hero-heading" class="hero__heading" tabindex="-1">${HERO.heading}</h1>
        <p class="hero__note">${HERO.note}</p>
    </div>
</section>`;
}

function renderToolList(): SafeHtml {
    const rows = TOOL_IDS.map(
        (id) => html`<li>
        <a class="tool-row" href="${hrefFor(id)}">
            <span class="tool-row__name">${TOOLS[id].name}</span>
            <span class="tool-row__question">${TOOLS[id].question}</span>
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
