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

startRouter(({ route, initial, notFound }) => {
    leaveView();
    leaveView = () => {};

    const view = route === 'home' ? renderHome() : renderToolPage(route);
    const note = notFound ? html`<p class="route-note">${ROUTE.notFound}</p>` : '';
    main.innerHTML = html`<div class="view${initial ? '' : ' view--enter'}">${note}${view}</div>`.value;
    document.title = pageTitle(route === 'home' ? undefined : TOOLS[route].name);
    bindFields(main);

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
