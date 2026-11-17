import './styles/main.css';
import { type RouteChange, startRouter } from './app/router.ts';
import { startStage } from './hero/bus.ts';
import { mountCounter } from './tools/left/counter.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields } from './ui/field-behaviour.ts';
import { mountHome, renderHome } from './ui/home.ts';
import { html } from './ui/html.ts';
import { renderMiner } from './ui/miner-view.ts';
import { markCurrent, trackChrome } from './ui/shell.ts';
import { mountStatus } from './ui/status.ts';
import { renderToolPage } from './ui/tool-page.ts';
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

function whileCurrent(view: number, mount: () => () => void): void {
    if (view === viewCount) cleanups.push(mount());
}

function show({ route, initial, notFound }: RouteChange, view: number): void {
    const prerendered = initial && route === 'home' && !notFound;
    if (!prerendered) {
        const page = route === 'home' ? renderHome() : route === 'miner' ? renderMiner() : renderToolPage(route);
        const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
        main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    }
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    document.documentElement.dataset.route = route;
    markCurrent(route);
    status.setRoute(route);
    bindFields(main);

    if (route === 'home') cleanups.push(mountHome(main));
    if (route === 'miner') {
        import('./tools/miner/index.ts').then(({ mountMiner }) => {
            whileCurrent(view, () => mountMiner(main, SITE));
        });
    }
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
}

startRouter((change) => {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
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
