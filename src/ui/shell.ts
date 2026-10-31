import { hrefFor } from '../app/routes.ts';
import { FOOTER, NOSCRIPT, SITE_NAME } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function renderHeader(): SafeHtml {
    return html`<header class="topbar">
    <a class="wordmark" href="${hrefFor('home')}">${SITE_NAME}</a>
</header>`;
}

export function renderNoscript(): SafeHtml {
    return html`<noscript><p class="noscript">${NOSCRIPT.needs}</p></noscript>`;
}

export function renderFooter(): SafeHtml {
    return html`<footer class="footer">
    <p>${FOOTER.privacy}</p>
    <a class="footer__follow" href="${FOOTER.followUrl}" rel="noopener noreferrer">${FOOTER.follow}</a>
</footer>`;
}

export function renderAnnouncer(): SafeHtml {
    return html`<div id="announcer" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>`;
}
