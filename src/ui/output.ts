import { SCENE_PARTS_LABEL, SHARE, TOOL_PAGE } from './copy.ts';
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
 * The scene: a title, the window the stage draws the tool's model into (with the SVG readout inside it for when
 * the 3D stage is off), engraved tags laid over it, a caption, a callout for the part in hand, and the same parts as
 * buttons for the keyboard. The window is the one place in a plate the stage shows through.
 */
export function sceneWindow(options: { head: SafeHtml | ''; caption: string }): SafeHtml {
    return html`<div class="scene">
    ${options.head}
    <div class="scene__window" data-scene-window>
        <div id="scene-plot" class="scene__plot" aria-hidden="true"></div>
        <div class="scene__tags" aria-hidden="true"></div>
    </div>
    <div class="scene__foot">
        <p id="scene-caption" class="scene__caption">${options.caption}</p>
        <p class="scene__about"></p>
        <p class="scene__callout" aria-live="polite" hidden></p>
    </div>
    <div class="scene__parts" role="group" aria-label="${SCENE_PARTS_LABEL}"></div>
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
