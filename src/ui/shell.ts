import { hrefFor } from '../app/routes.ts';
import { TOOL_GROUPS, TOOL_IDS } from '../tools/index.ts';
import { watchHeight } from '../util/dom.ts';
import { FOOTER, HOME, NAV, NOSCRIPT, SITE_NAME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { renderStatus } from './status.ts';

function followLink(className: string, text: string): SafeHtml {
    return html`<a class="${className}" href="${FOOTER.followUrl}" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>`;
}

const MENU_ICON = html`<svg class="menu-button__icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect width="5" height="5" rx="1"/><rect x="7" width="5" height="5" rx="1"/><rect y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/></svg>`;

/** Every machine by name and line, in its group. A native popover: Esc, an outside tap and the button close it. */
function renderMenu(): SafeHtml {
    const groups = TOOL_GROUPS.map(
        (group) => html`<section class="menu__group" aria-labelledby="menu-${group.id}">
            <h2 id="menu-${group.id}" class="menu__heading">${NAV.groups[group.id]}</h2>
            <ul class="menu__list">${group.tools.map(
                (id) =>
                    html`<li><a class="menu__link" href="${hrefFor(id)}" data-nav="${id}"><span class="menu__name">${TOOLS[id].name}</span><span class="menu__line">${TOOLS[id].description}</span></a></li>`,
            )}</ul>
        </section>`,
    );
    return html`<nav id="machines" class="menu" popover aria-label="${NAV.menuLabel}">
    <div class="menu__inner">${groups}</div>
</nav>`;
}

/** The bar: the name, every machine one tap away, @PlainBTC and the live facts. */
export function renderHeader(): SafeHtml {
    return html`<header class="topbar">
    <div class="topbar__inner">
        <a class="wordmark" href="${hrefFor('home')}" data-nav="home"><span class="wordmark__mark" aria-hidden="true"></span>${SITE_NAME}</a>
        <button class="menu-button" type="button" popovertarget="machines">${MENU_ICON}${NAV.menu}</button>
        ${renderStatus()}
        ${followLink('topbar__follow', FOOTER.handle)}
    </div>
    ${renderMenu()}
</header>`;
}

/** A page chosen from the menu replaces the view under it, so the menu closes with it. */
export function closeMenu(): void {
    const menu = document.getElementById('machines');
    if (menu?.matches(':popover-open')) menu.hidePopover();
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
            <p class="footer__motion">${FOOTER.motion}</p>
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
