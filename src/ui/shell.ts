import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { FOOTER, HOME, NAV, NOSCRIPT, SITE_NAME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { renderStatus } from './status.ts';

function followLink(className: string, text: string): SafeHtml {
    return html`<a class="${className}" href="${FOOTER.followUrl}" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>`;
}

export function renderHeader(): SafeHtml {
    const links = TOOL_IDS.map(
        (id) => html`<li><a class="nav__link" href="${hrefFor(id)}" data-nav="${id}">${NAV.short[id]}</a></li>`,
    );
    return html`<header class="topbar">
    <div class="topbar__inner">
        <a class="wordmark" href="${hrefFor('home')}" data-nav="home">${SITE_NAME}</a>
        <nav class="nav" aria-label="${NAV.label}">
            <ul class="nav__list">${links}</ul>
        </nav>
        ${followLink('topbar__follow', FOOTER.handle)}
        ${renderStatus()}
    </div>
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
        </div>
        <nav class="footer__tools" aria-label="${FOOTER.toolsLabel}">
            <ul class="footer__list">${links}</ul>
        </nav>
        ${followLink('footer__follow', FOOTER.follow)}
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
