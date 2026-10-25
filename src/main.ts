import './styles/main.css';
import { startRouter } from './app/router.ts';
import { mountHero } from './hero/index.ts';
import { pageTitle, TOOLS } from './ui/copy.ts';
import { renderHome } from './ui/home.ts';
import { renderToolPage } from './ui/tool-page.ts';
import { byId, whenIdle } from './util/dom.ts';

const main = byId('main');
const announcer = byId('announcer');

startRouter((route, initial) => {
    const page = route === 'home' ? undefined : TOOLS[route].name;
    main.innerHTML = (route === 'home' ? renderHome() : renderToolPage(route)).value;
    document.title = pageTitle(page);

    if (route === 'home') {
        const host = byId('hero-canvas');
        whenIdle(() => {
            if (host.isConnected) mountHero(host);
        });
    }

    if (!initial) {
        window.scrollTo(0, 0);
        main.querySelector<HTMLElement>('h1')?.focus();
        announcer.textContent = document.title;
    }
});
