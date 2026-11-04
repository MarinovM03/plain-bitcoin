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
import { prefersReducedMotion } from './util/motion.ts';

const SITE = import.meta.env.VITE_SITE_URL;
const FLIP_MS = 320;
const FLIP: Keyframe[] = [
    { transform: 'perspective(1600px) rotateX(-82deg)', opacity: 0.25 },
    { transform: 'perspective(1600px) rotateX(6deg)', opacity: 1, offset: 0.72 },
    { transform: 'none', opacity: 1 },
];

const main = byId('main');
const announcer = byId('announcer');
trackChrome(find(document, '.bezel'));
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

/**
 * Changing mode swaps the face on its mount like a rotary selector, while the body keeps flowing behind it.
 * Transform and opacity only; the face takes input throughout; reduced motion swaps at once.
 */
function flipIn(route: string): void {
    if (prefersReducedMotion()) return;
    const faces = [...main.querySelectorAll<HTMLElement>('.gauge, .overview, .tile')];
    main.dataset.flip = route;
    const runs = faces.map((face, i) =>
        face.animate(FLIP, { duration: FLIP_MS, delay: Math.min(i, 6) * 36, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }),
    );
    void Promise.allSettled(runs.map((run) => run.finished)).then(() => {
        if (main.dataset.flip === route) delete main.dataset.flip;
    });
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
        main.innerHTML = html`<div class="view">${note}${page}</div>`.value;
    }
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    markCurrent(route);
    status.setRoute(route);
    bindFields(main);
    cleanups.push(watchTyping(main), trackMore(main));
    if (!initial) flipIn(route);

    if (route === 'home') cleanups.push(mountHome(main, SITE));
    if (route === 'home' || route === 'left') cleanups.push(mountCounter(main, announce));
    if (route === 'left') {
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
