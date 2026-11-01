import { SHARE, TOOL_PAGE } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export const EMPTY_FIGURE = '—';

export function resultBlock(options: { id: string; label: string; empty: string }): SafeHtml {
    return html`<section class="result" aria-labelledby="${options.id}-label">
    <p id="${options.id}-label" class="result__label">${options.label}</p>
    <p id="${options.id}-figure" class="result__figure" aria-hidden="true">${EMPTY_FIGURE}</p>
    <p id="${options.id}" class="result__sentence"><span class="result__empty">${options.empty}</span></p>
    <p id="${options.id}-detail" class="result__detail"></p>
    <p id="${options.id}-status" class="visually-hidden" aria-live="polite"></p>
</section>`;
}

export function sceneWindow(options: { head: SafeHtml; caption: string; still?: SafeHtml }): SafeHtml {
    return html`<div class="scene">
    ${options.head}
    <div id="scene-plot" class="scene__plot" aria-hidden="true"${options.still ? html` data-still="own"` : ''}>${options.still ?? ''}</div>
    <p id="scene-caption" class="scene__caption">${options.caption}</p>
</div>`;
}

export function moreOptions(label: string, body: SafeHtml): SafeHtml {
    return html`<details class="more" open>
    <summary class="more__toggle">${label}</summary>
    <div class="more__body">${body}</div>
</details>`;
}

export function shareSection(extra: SafeHtml | '' = ''): SafeHtml {
    return html`<div class="share">
    <div class="share__actions">
        ${shareBar()}
        ${postLink()}
    </div>
    ${extra}
</div>`;
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
