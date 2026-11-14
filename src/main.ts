import './styles/main.css';
import { startRouter } from './app/router.ts';
import { mountField } from './hero/bus.ts';
import { mountCounter } from './tools/left/counter.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields } from './ui/field-behaviour.ts';
import { mountHome, renderHome } from './ui/home.ts';
import { html } from './ui/html.ts';
import { bindMenu, markCurrent, trackChrome } from './ui/shell.ts';
import { mountStatus } from './ui/status.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { afterFirstPaint, byId, find } from './util/dom.ts';

const SITE = import.meta.env.VITE_SITE_URL;

const main = byId('main');
const announcer = byId('announcer');
trackChrome(find(document, '.topbar'));
bindMenu(byId<HTMLDetailsElement>('menu'));
const FIELD_LEVEL = { home: 1, tool: 0.6 } as const;
const field = mountField(afterFirstPaint);
const status = mountStatus(byId('status'), document.querySelector<SVGPathElement>('#barcode path'), field.setHash);
const announce = (message: string) => {
    announcer.textContent = message;
};
let cleanups: (() => void)[] = [];
let viewCount = 0;

function whileCurrent(view: number, mount: () => () => void): void {
    if (view === viewCount) cleanups.push(mount());
}

startRouter(({ route, initial, notFound }) => {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    const view = ++viewCount;

    const prerendered = initial && route === 'home' && !notFound;
    if (!prerendered) {
        const page = route === 'home' ? renderHome() : renderToolPage(route);
        const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
        main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    }
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    document.documentElement.dataset.route = route;
    markCurrent(route);
    status.setRoute(route);
    field.setLevel(route === 'home' ? FIELD_LEVEL.home : FIELD_LEVEL.tool);
    bindFields(main);

    if (route === 'home') cleanups.push(mountHome(main, SITE, announce));
    if (route === 'left') {
        cleanups.push(mountCounter(main, announce));
        import('./tools/left/index.ts').then(({ mountLeft }) => {
            whileCurrent(view, () => mountLeft(main, SITE));
        });
    }
    if (route === 'power') {
        import('./tools/power/index.ts').then(({ mountPower }) => {
            whileCurrent(view, () => mountPower(main, SITE));
        });
    }
    if (route === 'convert') {
        import('./tools/convert/index.ts').then(({ mountConvert }) => {
            whileCurrent(view, () => mountConvert(main, SITE));
        });
    }
    if (route === 'address') {
        import('./tools/address/index.ts').then(({ mountAddress }) => {
            whileCurrent(view, () => mountAddress(main, SITE));
        });
    }
    if (route === 'dca') {
        import('./tools/dca/index.ts').then(({ mountDca }) => {
            whileCurrent(view, () => mountDca(main, SITE));
        });
    }

    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announce(notFound ? ROUTE.notFound : document.title);
    }
});
