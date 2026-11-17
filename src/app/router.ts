import { hrefFor, parseHash, parsePath, type RouteId } from './routes.ts';

export interface RouteChange {
    route: RouteId;
    initial: boolean;
    notFound: boolean;
}

/** A plain left click on a link to one of the site's own pages; anything else is left to the browser. */
function ownPage(event: MouseEvent): string | null {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    )
        return null;
    const link = (event.target as Element | null)?.closest('a');
    if (!link || link.target || link.hasAttribute('download') || link.origin !== window.location.origin) return null;
    return parsePath(link.pathname) === null ? null : link.pathname;
}

export function startRouter(onRoute: (change: RouteChange) => void): void {
    let initial = true;
    const old = parseHash(window.location.hash);
    if (window.location.hash.startsWith('#/') && old !== null)
        window.history.replaceState(null, '', `${hrefFor(old)}${window.location.search}`);

    const resolve = () => {
        const route = parsePath(window.location.pathname);
        if (route === null) window.history.replaceState(null, '', `${hrefFor('home')}${window.location.search}`);
        onRoute({ route: route ?? 'home', initial, notFound: route === null });
        initial = false;
    };

    document.addEventListener('click', (event) => {
        const path = ownPage(event);
        if (path === null) return;
        event.preventDefault();
        if (path !== window.location.pathname) window.history.pushState(null, '', path);
        resolve();
    });
    window.addEventListener('popstate', resolve);
    resolve();
}
