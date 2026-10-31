import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { HOME, TOOLS } from './copy.ts';
import { renderHero } from './hero.ts';
import { html, type SafeHtml } from './html.ts';

function renderToolList(): SafeHtml {
    const rows = TOOL_IDS.map(
        (id, index) => html`<li class="tool-list__item tool-list__item--${id}">
        <a class="tool-row" href="${hrefFor(id)}">
            <span class="tool-row__name">${TOOLS[id].name}</span>
            <span class="tool-row__question">${TOOLS[id].question}</span>
            <span class="tool-row__preview">${TOOLS[id].preview}</span>
            <span class="tool-row__kind">${TOOLS[id].kind}</span>
            <span class="tool-row__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            <span class="tool-row__cta" aria-hidden="true">${HOME.open} →</span>
        </a>
    </li>`,
    );
    return html`<section class="tools" aria-labelledby="tools-heading">
    <div class="section-head">
        <p class="eyebrow">${HOME.toolsKicker}</p>
        <h2 id="tools-heading" class="section-head__title">${HOME.toolsHeading}</h2>
    </div>
    <ul class="tool-list">${rows}</ul>
</section>`;
}

function renderIntro(): SafeHtml {
    const facts = HOME.facts.map(
        (fact) => html`<li class="fact">
            <span class="fact__figure">${fact.figure}</span>
            <span class="fact__text">${fact.text}</span>
        </li>`,
    );
    const cautions = HOME.cautions.map((line) => html`<li class="intro__caution">${line}</li>`);
    return html`<section class="intro panel" aria-labelledby="start-heading">
    <div class="intro__lead">
        <h2 id="start-heading" class="eyebrow">${HOME.startHeading}</h2>
        <p class="intro__promise">${HOME.promise}</p>
        <p class="intro__detail">${HOME.promiseDetail}</p>
    </div>
    <ul class="intro__facts">${facts}</ul>
    <ul class="intro__cautions">${cautions}</ul>
</section>`;
}

export function renderHome(): SafeHtml {
    return html`${renderHero()}
<div class="home">
    ${renderIntro()}
    ${renderToolList()}
</div>`;
}
