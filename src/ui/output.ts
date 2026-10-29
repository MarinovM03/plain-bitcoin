import { SHARE, TOOL_PAGE } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function resultBlock(options: { id: string; label: string; empty: string; sentence?: boolean }): SafeHtml {
    return html`<div class="result${options.sentence ? ' result--sentence' : ''}">
    <p id="${options.id}-label" class="result__label">${options.label}</p>
    <p id="${options.id}" class="result__figure"><span class="result__empty">${options.empty}</span></p>
    <p id="${options.id}-detail" class="result__detail"></p>
    <p id="${options.id}-status" class="visually-hidden" aria-live="polite"></p>
</div>`;
}

export function sourceLine(text: string = TOOL_PAGE.sourcePending, id = ''): SafeHtml {
    return html`<p class="source-line"${id ? html` id="${id}"` : ''}>${text}</p>`;
}

export function noteLine(text: string): SafeHtml {
    return html`<p class="note-line">${text}</p>`;
}

export function shareBar(): SafeHtml {
    return html`<div class="share-bar" role="group" aria-label="${SHARE.label}">
    <button class="button button--primary" type="button" data-share="card" disabled>${SHARE.card}</button>
    <button class="button" type="button" data-share="download" disabled>${SHARE.download}</button>
    <button class="button" type="button" data-share="copy" disabled>${SHARE.copy}</button>
</div>`;
}
