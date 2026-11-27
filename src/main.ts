import './styles/main.css';
import { type RouteChange, startRouter } from './app/router.ts';
import type { RouteId } from './app/routes.ts';
import { startStage } from './hero/bus.ts';
import type { ToolId } from './tools/index.ts';
import { mountCounter } from './tools/left/counter.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields } from './ui/field-behaviour.ts';
import { renderHalving } from './ui/halving-view.ts';
import { mountHome, renderHome } from './ui/home.ts';
import { html, type SafeHtml } from './ui/html.ts';
import { renderMiner } from './ui/miner-view.ts';
import { markCurrent, trackChrome } from './ui/shell.ts';
import { mountStatus } from './ui/status.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { renderTx } from './ui/tx-view.ts';
import { afterFirstPaint, byId, find } from './util/dom.ts';
import { prefersReducedMotion } from './util/motion.ts';

const SITE = import.meta.env.VITE_SITE_URL;

const main = byId('main');
const announcer = byId('announcer');
trackChrome(find(document, '.topbar'));
startStage(afterFirstPaint);
const status = mountStatus(byId('status'), document.querySelector<SVGPathElement>('#barcode path'));
const announce = (message: string) => {
    announcer.textContent = message;
};
let cleanups: (() => void)[] = [];
let viewCount = 0;
let leaving = 0;
/** The page on show staggers out for this long before the next one is drawn; matches `leave` in motion.css. */
const LEAVE_MS = 190;

type Mount = (root: HTMLElement, site: string) => () => void;

/** Each page's code is its own chunk, fetched when the page opens. */
const MOUNTS: Record<ToolId, () => Promise<Mount>> = {
    miner: () => import('./tools/miner/index.ts').then((module) => module.mountMiner),
    left: () => import('./tools/left/index.ts').then((module) => module.mountLeft),
    halving: () => import('./tools/halving/index.ts').then((module) => module.mountHalving),
    tx: () => import('./tools/tx/index.ts').then((module) => module.mountTx),
    fees: () => import('./tools/fees/index.ts').then((module) => module.mountFees),
    power: () => import('./tools/power/index.ts').then((module) => module.mountPower),
    convert: () => import('./tools/convert/index.ts').then((module) => module.mountConvert),
    dca: () => import('./tools/dca/index.ts').then((module) => module.mountDca),
    stack: () => import('./tools/stack/index.ts').then((module) => module.mountStack),
    address: () => import('./tools/address/index.ts').then((module) => module.mountAddress),
};

function renderRoute(route: RouteId): SafeHtml {
    switch (route) {
        case 'home':
            return renderHome();
        case 'miner':
            return renderMiner();
        case 'halving':
            return renderHalving();
        case 'tx':
            return renderTx();
        default:
            return renderToolPage(route);
    }
}

/** `main[data-ready]` names the page once its own code is running, so a check can wait for it. */
function whileCurrent(view: number, route: RouteId, mount: () => () => void): void {
    if (view !== viewCount) return;
    cleanups.push(mount());
    main.dataset.ready = route;
}

function show({ route, initial, notFound }: RouteChange, view: number): void {
    const prerendered = initial && route === 'home' && !notFound;
    if (!prerendered) {
        const page = renderRoute(route);
        const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
        main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    }
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    document.documentElement.dataset.route = route;
    markCurrent(route);
    status.setRoute(route);
    bindFields(main);

    if (route === 'home') cleanups.push(mountHome(main, SITE));
    if (route === 'left') cleanups.push(mountCounter(main, announce));
    if (route !== 'home') {
        // A load cut short (the page left, or the network gone) leaves the prerendered page as it is.
        MOUNTS[route]()
            .then((mount) => {
                whileCurrent(view, route, () => mount(main, SITE));
            })
            .catch(() => {});
    }

    if (initial && notFound) announce(ROUTE.notFound);
    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announce(notFound ? ROUTE.notFound : document.title);
    }
}

startRouter((change) => {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    delete main.dataset.ready;
    const view = ++viewCount;
    window.clearTimeout(leaving);
    const old = change.initial || prefersReducedMotion() ? null : main.firstElementChild;
    if (!old) {
        show(change, view);
        return;
    }
    old.classList.add('view--leave');
    leaving = window.setTimeout(() => show(change, view), LEAVE_MS);
});
