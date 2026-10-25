import { hrefFor, parseHash, type RouteId } from './routes.ts';

export type RouteHandler = (route: RouteId, initial: boolean) => void;

export function startRouter(onRoute: RouteHandler): void {
    let initial = true;
    const resolve = () => {
        const route = parseHash(window.location.hash);
        if (route === null) window.history.replaceState(null, '', hrefFor('home'));
        onRoute(route ?? 'home', initial);
        initial = false;
    };
    window.addEventListener('hashchange', resolve);
    resolve();
}
