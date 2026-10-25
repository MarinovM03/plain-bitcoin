import { hrefFor } from '../app/routes.ts';
import type { ToolId } from '../tools/index.ts';
import { TOOL_PAGE, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function renderToolPage(id: ToolId): SafeHtml {
    return html`<article class="tool-page">
    <a class="back-link" href="${hrefFor('home')}"><span aria-hidden="true">←</span> ${TOOL_PAGE.back}</a>
    <h1 class="tool-page__title" tabindex="-1">${TOOLS[id].name}</h1>
    <p class="tool-page__question">${TOOLS[id].question}</p>
    <p class="tool-page__pending">${TOOL_PAGE.pending}</p>
</article>`;
}
