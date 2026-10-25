import { hrefFor, parseHash, type RouteId } from './routes.ts';

export interface RouteChange {
    route: RouteId;
    initial: boolean;
    notFound: boolean;
}

export function startRouter(onRoute: (change: RouteChange) => void): void {
    let initial = true;
    const resolve = () => {
        const route = parseHash(window.location.hash);
        if (route === null) window.history.replaceState(null, '', hrefFor('home'));
        onRoute({ route: route ?? 'home', initial, notFound: route === null });
        initial = false;
    };
    window.addEventListener('hashchange', resolve);
    resolve();
}
