import './styles/main.css';
import { startRouter } from './app/router.ts';
import { mountCounter } from './tools/left/counter.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields } from './ui/field-behaviour.ts';
import { renderHome } from './ui/home.ts';
import { html } from './ui/html.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { byId } from './util/dom.ts';

const main = byId('main');
const announcer = byId('announcer');
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

    const page = route === 'home' ? renderHome() : renderToolPage(route);
    const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
    main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    bindFields(main);

    if (route === 'home' || route === 'left') {
        cleanups.push(mountCounter(main, route === 'left' ? 'field' : 'edge', announce));
    }
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

    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announce(notFound ? ROUTE.notFound : document.title);
    }
});
