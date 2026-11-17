import { isToolId, type ToolId } from '../tools/index.ts';

export type RouteId = 'home' | ToolId;

function routeOf(path: string): RouteId | null {
    const name = path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (name === '') return 'home';
    return isToolId(name) ? name : null;
}

/** A page path, e.g. `/miner`. Anything that is not a page is null. */
export function parsePath(pathname: string): RouteId | null {
    return routeOf(pathname);
}

/** The old address form, `#/miner`, still read so shared links keep working. */
export function parseHash(hash: string): RouteId | null {
    return routeOf(hash.replace(/^#/, ''));
}

export function hrefFor(route: RouteId): string {
    return route === 'home' ? '/' : `/${route}`;
}
