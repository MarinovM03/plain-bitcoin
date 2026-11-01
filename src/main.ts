import './styles/main.css';
import { startRouter } from './app/router.ts';
import { stage, startStage } from './hero/bus.ts';
import { mountCounter } from './tools/left/counter.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields, trackMore, watchTyping } from './ui/field-behaviour.ts';
import { mountHome, renderHome } from './ui/home.ts';
import { html } from './ui/html.ts';
import { markCurrent, trackChrome } from './ui/shell.ts';
import { mountStatus } from './ui/status.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { afterFirstPaint, byId, find } from './util/dom.ts';

const main = byId('main');
const announcer = byId('announcer');
trackChrome(find(document, '.topbar'));
startStage(byId('stage'), afterFirstPaint);
const status = mountStatus(byId('status'));
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
    stage.clear();

    const prerendered = initial && route === 'home' && !notFound;
    if (!prerendered) {
        const page = route === 'home' ? renderHome() : renderToolPage(route);
        const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
        main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    }
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    markCurrent(route);
    status.setRoute(route);
    bindFields(main);
    cleanups.push(watchTyping(main), trackMore(main));

    if (route === 'home') cleanups.push(mountHome(main));
    if (route === 'home' || route === 'left') cleanups.push(mountCounter(main, announce));
    if (route === 'left') {
        import('./tools/left/index.ts').then(({ mountLeft }) => {
            whileCurrent(view, () => mountLeft(main, import.meta.env.VITE_SITE_URL));
        });
    }
    if (route === 'power') {
        import('./tools/power/index.ts').then(({ mountPower }) => {
            whileCurrent(view, () => mountPower(main, import.meta.env.VITE_SITE_URL));
        });
    }
    if (route === 'convert') {
        import('./tools/convert/index.ts').then(({ mountConvert }) => {
            whileCurrent(view, () => mountConvert(main, import.meta.env.VITE_SITE_URL));
        });
    }
    if (route === 'address') {
        import('./tools/address/index.ts').then(({ mountAddress }) => {
            whileCurrent(view, () => mountAddress(main, import.meta.env.VITE_SITE_URL));
        });
    }
    if (route === 'dca') {
        import('./tools/dca/index.ts').then(({ mountDca }) => {
            whileCurrent(view, () => mountDca(main, import.meta.env.VITE_SITE_URL));
        });
    }

    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announce(notFound ? ROUTE.notFound : document.title);
    }
});
