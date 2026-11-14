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
 * The bar: the name, one Tools menu that lists every tool by its full plain name, @PlainBTC and the live facts.
 * The line under it is the newest block's hash, drawn as marks; it stays a plain hairline until a hash is known.
 */
export function renderHeader(): SafeHtml {
    const links = TOOL_IDS.map(
        (id) => html`<li>
            <a class="menu__link" href="${hrefFor(id)}" data-nav="${id}">
                <span class="menu__name">${TOOLS[id].name}</span>
                <span class="menu__description">${TOOLS[id].description}</span>
            </a>
        </li>`,
    );
    return html`<header class="topbar">
    <div class="topbar__inner">
        <a class="wordmark" href="${hrefFor('home')}" data-nav="home">${SITE_NAME}</a>
        <details id="menu" class="menu">
            <summary class="menu__toggle">${NAV.menu}</summary>
            <nav class="menu__panel" aria-label="${NAV.label}">
                <ul class="menu__list">${links}</ul>
            </nav>
        </details>
        ${followLink('topbar__follow', FOOTER.handle)}
        ${renderStatus()}
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

/** The Tools menu closes when a tool is chosen, on Escape (focus goes back to the button) and on a press outside. */
export function bindMenu(menu: HTMLDetailsElement): void {
    const toggle = menu.querySelector<HTMLElement>('summary');
    const close = () => {
        menu.open = false;
    };
    menu.addEventListener('click', (event) => {
        if ((event.target as Element | null)?.closest('a')) close();
    });
    menu.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !menu.open) return;
        close();
        toggle?.focus();
    });
    document.addEventListener('pointerdown', (event) => {
        if (menu.open && !menu.contains(event.target as Node)) close();
    });
    window.addEventListener('hashchange', close);
}

export function trackChrome(topbar: HTMLElement): void {
    watchHeight(topbar, (height) => document.documentElement.style.setProperty('--chrome', `${height}px`));
}
