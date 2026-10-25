import { isToolId, type ToolId } from '../tools/index.ts';

export type RouteId = 'home' | ToolId;

export function parseHash(hash: string): RouteId | null {
    const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    if (path === '') return 'home';
    return isToolId(path) ? path : null;
}

export function hrefFor(route: RouteId): string {
    return route === 'home' ? '#/' : `#/${route}`;
}
