import { hrefFor } from '../app/routes.ts';
import { TOOL_IDS } from '../tools/index.ts';
import { FOOTER, HOME, NAV, NOSCRIPT, SITE_NAME, TOOLS } from './copy.ts';
import { html, type SafeHtml } from './html.ts';
import { renderStatus } from './status.ts';

function followLink(className: string, text: string): SafeHtml {
    return html`<a class="${className}" href="${FOOTER.followUrl}" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>`;
}

export function renderStage(): SafeHtml {
    return html`<div id="stage" class="stage" aria-hidden="true"></div>`;
}

/** The mode switches: one physical selector for the five gauges, its knob sliding to the one in use. */
function renderModes(): SafeHtml {
    const links = TOOL_IDS.map(
        (id, i) =>
            html`<li class="modes__item"><a class="mode" href="${hrefFor(id)}" data-nav="${id}"><span class="mode__index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="mode__name">${NAV.short[id]}</span></a></li>`,
    );
    return html`<nav class="modes" aria-label="${NAV.label}">
    <ul class="modes__list">${links}</ul>
    <span class="modes__knob" aria-hidden="true"></span>
</nav>`;
}

export function renderHeader(): SafeHtml {
    return html`<header class="bezel" data-plate>
    <div class="bezel__inner">
        <a class="wordmark" href="${hrefFor('home')}" data-nav="home">${SITE_NAME}</a>
        ${renderModes()}
        ${followLink('bezel__follow', FOOTER.handle)}
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
    return html`<footer class="footer" data-plate>
    <div class="footer__inner">
        <div class="footer__brand">
            <p class="footer__name">${SITE_NAME}</p>
            <p class="footer__promise">${HOME.promise}</p>
            <p class="footer__privacy">${FOOTER.privacy}</p>
            <p class="footer__motion">${FOOTER.motion}</p>
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

/** Marks the gauge in use and slides the knob under its switch; on home the knob rests out of sight. */
export function markCurrent(route: string): void {
    for (const link of document.querySelectorAll<HTMLElement>('[data-nav]')) {
        if (link.dataset.nav === route) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    placeKnob();
}

export function placeKnob(): void {
    const modes = document.querySelector<HTMLElement>('.modes');
    const current = modes?.querySelector<HTMLElement>('.mode[aria-current="page"]');
    if (!modes) return;
    modes.toggleAttribute('data-engaged', current !== null && current !== undefined);
    if (!current) return;
    modes.style.setProperty('--knob-x', `${current.offsetLeft}px`);
    modes.style.setProperty('--knob-w', String(current.offsetWidth / 100));
    // The first placement lands without sliding; every change after it slides the knob.
    if (modes.dataset.ready === undefined) requestAnimationFrame(() => modes.setAttribute('data-ready', ''));
}

export function trackChrome(bezel: HTMLElement): void {
    const sync = () => {
        document.documentElement.style.setProperty('--chrome', `${bezel.offsetHeight}px`);
        placeKnob();
    };
    sync();
    new ResizeObserver(() => requestAnimationFrame(sync)).observe(bezel);
}
