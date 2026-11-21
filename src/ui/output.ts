import { PICTURE, SHARE, TOOL_PAGE } from './copy.ts';
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

/**
 * A tool's picture: a flat drawing of the answer on an opaque plate, a caption in words, and a callout for a band.
 * A titled picture is the one the postcard carries, and says so.
 */
export function pictureFrame(caption: string, head?: { title: string; key?: SafeHtml }): SafeHtml {
    const top = head
        ? html`<div class="picture__head">
        <h2 class="picture__title">${head.title}</h2>
        <p class="picture__tag">${PICTURE.onCard}</p>
        ${head.key ?? ''}
    </div>`
        : '';
    return html`<div class="picture${head ? ' picture--titled' : ''}">
    ${top}
    <div id="picture-plot" class="picture__plot"></div>
    <div class="picture__foot">
        <p id="picture-caption" class="picture__caption">${caption}</p>
        <p class="picture__callout" aria-live="polite" hidden></p>
    </div>
</div>`;
}

export function moreOptions(label: string, body: SafeHtml): SafeHtml {
    return html`<details class="more" open>
    <summary class="more__toggle">${label}</summary>
    <div class="more__body">${body}</div>
</details>`;
}

export function shareBar(): SafeHtml {
    return html`<div class="share-bar" role="group" aria-label="${SHARE.label}">
    <button class="button button--primary share-bar__print" type="button" data-share="print" disabled>${SHARE.print}</button>
    <button class="button" type="button" data-share="download" disabled>${SHARE.download}</button>
    <a class="button share-bar__post" href="https://x.com/intent/post" data-share-post target="_blank" rel="noopener noreferrer" aria-disabled="true" tabindex="-1">${SHARE.post} <span aria-hidden="true">↗</span></a>
</div>`;
}

export function shareSection(extra: SafeHtml | '' = ''): SafeHtml {
    return html`<div class="share">
    <p class="share__title">${SHARE.title} <span class="share__tag">${SHARE.titleTag}</span></p>
    ${shareBar()}
    <p class="share__note">${SHARE.madeHere}</p>
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
