import './styles/main.css';
import { startRouter } from './app/router.ts';
import { mountHero } from './hero/index.ts';
import { pageTitle, ROUTE, TOOLS } from './ui/copy.ts';
import { bindFields } from './ui/field-behaviour.ts';
import { renderHome } from './ui/home.ts';
import { html } from './ui/html.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { byId, whenIdle } from './util/dom.ts';

const main = byId('main');
const announcer = byId('announcer');
let leaveView = () => {};
let viewCount = 0;

startRouter(({ route, initial, notFound }) => {
    leaveView();
    leaveView = () => {};
    const view = ++viewCount;

    const page = route === 'home' ? renderHome() : renderToolPage(route);
    const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
    main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${page}</div>`.value;
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    bindFields(main);

    if (route === 'power') {
        import('./tools/power/index.ts').then(({ mountPower }) => {
            if (view === viewCount) leaveView = mountPower(main, import.meta.env.VITE_SITE_URL);
        });
    }

    const stage = document.getElementById('hero-stage');
    if (stage) {
        whenIdle(() => {
            if (stage.isConnected) leaveView = mountHero(stage);
        });
    }

    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announcer.textContent = notFound ? ROUTE.notFound : document.title;
    }
});
