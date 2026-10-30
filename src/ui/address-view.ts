import { ADDRESS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { noteLine } from './output.ts';

export function renderAddressInputs(): SafeHtml {
    return html`<div class="field">
    <label class="field__label" for="address-input">${ADDRESS.field}</label>
    <div class="field__control address-field">
        <input id="address-input" class="field__input address-field__input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${ADDRESS.placeholder}" />
        <button id="address-paste" class="address-field__paste" type="button" hidden>${ADDRESS.paste}</button>
    </div>
</div>
<p id="address-guard" class="guard-line" role="status" hidden></p>
${noteLine(ADDRESS.offline)}`;
}

export function renderAddressCardToggle(): SafeHtml {
    return html`<label class="card-toggle">
    <input id="address-card-full" class="card-toggle__input" type="checkbox" />
    <span>${ADDRESS.cardToggle}</span>
</label>`;
}

export function renderAddressDetail(): SafeHtml {
    return html`<section id="address-parts" class="address-parts" aria-labelledby="address-parts-heading" hidden>
    <h2 id="address-parts-heading" class="numbers__heading">${ADDRESS.partsHeading}</h2>
    <p id="address-text" class="address-parts__text"></p>
    <p id="address-bytes" class="address-parts__text address-parts__text--bytes" hidden></p>
    <dl id="address-legend" class="address-parts__legend"></dl>
</section>
<p id="address-about" class="note-line" hidden></p>
<p id="address-multisig" class="note-line" hidden>${ADDRESS.multisig}</p>
<section class="lookup" aria-labelledby="lookup-heading">
    <h2 id="lookup-heading" class="numbers__heading">${ADDRESS.lookupHeading}</h2>
    <p class="lookup__note">${ADDRESS.apiNote}</p>
    <button id="address-lookup" class="button button--block" type="button" disabled>${ADDRESS.lookUp}</button>
    <p id="address-lookup-status" class="source-line" role="status" hidden></p>
    <dl id="address-chain" class="numbers__panel" hidden></dl>
    <a id="address-explorer" class="lookup__link" href="https://mempool.space/" rel="noopener noreferrer" hidden>${ADDRESS.explorer}</a>
</section>`;
}
