import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { watchHeight } from '../util/dom.ts';
import { FOOTER, HOME, NAV, NOSCRIPT, SITE_NAME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { renderStatus } from './status.ts';

function followLink(className: string, text: string): SafeHtml {
    return html`<a class="${className}" href="${FOOTER.followUrl}" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>`;
}

/**
 * The bar: the name, a way back to every machine, @PlainBTC and the live facts. The line under it is the newest
 * block's hash, drawn as marks; it stays a plain hairline until a hash is known.
 */
export function renderHeader(): SafeHtml {
    return html`<header class="topbar">
    <div class="topbar__inner">
        <a class="wordmark" href="${hrefFor('home')}" data-nav="home"><span class="wordmark__mark" aria-hidden="true"></span>${SITE_NAME}</a>
        <a class="topbar__all" href="${hrefFor('home')}">${NAV.all}</a>
        ${renderStatus()}
        ${followLink('topbar__follow', FOOTER.handle)}
    </div>
    <svg id="barcode" class="barcode" viewBox="0 0 256 1" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d=""/></svg>
</header>`;
}

export function renderNoscript(): SafeHtml {
    return html`<noscript><p class="noscript">${NOSCRIPT.needs}</p></noscript>`;
}

export function renderFooter(): SafeHtml {
    const links = TOOL_IDS.map(
        (id) => html`<li><a class="footer__link" href="${hrefFor(id)}">${TOOLS[id].name}</a></li>`,
    );
    return html`<footer class="footer">
    <div class="footer__inner">
        <div class="footer__brand">
            <p class="footer__name">${SITE_NAME}</p>
            <p class="footer__promise">${HOME.promise}</p>
            <p class="footer__privacy">${FOOTER.privacy}</p>
            <p class="footer__motion">${FOOTER.motion} ${FOOTER.barcode}</p>
            ${followLink('footer__follow', FOOTER.follow)}
        </div>
        <nav class="footer__tools" aria-label="${FOOTER.toolsLabel}">
            <ul class="footer__list">${links}</ul>
        </nav>
    </div>
</footer>`;
}

export function renderAnnouncer(): SafeHtml {
    return html`<div id="announcer" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>`;
}

export function markCurrent(route: string): void {
    for (const link of document.querySelectorAll<HTMLElement>('[data-nav]')) {
        if (link.dataset.nav === route) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
}

export function trackChrome(topbar: HTMLElement): void {
    watchHeight(topbar, (height) => document.documentElement.style.setProperty('--chrome', `${height}px`));
}
