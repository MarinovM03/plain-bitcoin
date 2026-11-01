import { SHARE, TOOL_PAGE } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function resultBlock(options: { id: string; label: string; empty: string; extra?: SafeHtml | '' }): SafeHtml {
    return html`<section class="result" aria-labelledby="${options.id}-label">
    <p id="${options.id}-label" class="result__label">${options.label}</p>
    <p id="${options.id}" class="result__figure"><span class="result__empty">${options.empty}</span></p>
    <p id="${options.id}-detail" class="result__detail"></p>
    <p id="${options.id}-status" class="visually-hidden" aria-live="polite"></p>
    <div class="result__actions">
        ${shareBar()}
        ${postLink()}
    </div>
    ${options.extra ?? ''}
</section>`;
}

export function sourceLine(privacy: string, text: string = TOOL_PAGE.sourcePending): SafeHtml {
    return html`<div class="tool__source">
    <p id="tool-source" class="source-line">${text}</p>
    <p class="privacy-line">${privacy}</p>
</div>`;
}

export function noteLine(text: string): SafeHtml {
    return html`<p class="note-line">${text}</p>`;
}

export function postLink(): SafeHtml {
    return html`<a class="post-link" href="https://x.com/intent/post" data-share-post target="_blank" rel="noopener noreferrer" aria-disabled="true" tabindex="-1">${SHARE.post} <span aria-hidden="true">↗</span></a>`;
}

export function shareBar(): SafeHtml {
    return html`<div class="share-bar" role="group" aria-label="${SHARE.label}">
    <button class="button button--primary" type="button" data-share="card" disabled>${SHARE.card}</button>
    <button class="button" type="button" data-share="download" disabled>${SHARE.download}</button>
    <button class="button" type="button" data-share="copy" disabled>${SHARE.copy}</button>
</div>`;
}
