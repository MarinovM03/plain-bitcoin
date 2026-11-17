import type { RouteId } from '../app/routes.ts';
import { HEIGHT_ANCHOR } from '../data/height.ts';
import { MAX_SUPPLY, supplyAt } from '../model/supply.ts';
import { OG_IMAGE, OG_PAGES, TOOLS } from '../ui/copy.ts';
import { canvasBlob, renderPostcard } from './render.ts';
import type { Postcard, Signature } from './types.ts';

const SUPPLY: Signature = {
    kind: 'supply',
    issued: supplyAt(HEIGHT_ANCHOR.height).issued,
    max: MAX_SUPPLY,
    undated: true,
};

function signatureFor(route: RouteId): Signature {
    if (route === 'miner') return { kind: 'well', best: -1, needed: 79 };
    if (route === 'home' || route === 'left' || route === 'halving') return SUPPLY;
    return { kind: 'blank' };
}

function cardFor(route: RouteId): Postcard {
    if (route === 'home') {
        return {
            tool: 'home',
            route: '',
            kicker: OG_IMAGE.kicker,
            number: OG_IMAGE.number,
            line: OG_IMAGE.line,
            source: OG_IMAGE.source,
            signature: signatureFor(route),
            alt: OG_IMAGE.alt,
        };
    }
    const page = OG_PAGES[route];
    return {
        tool: route,
        route,
        kicker: `${OG_IMAGE.kicker} · ${TOOLS[route].name}`,
        number: page.number,
        line: page.line,
        source: OG_IMAGE.source,
        signature: signatureFor(route),
        alt: page.alt,
    };
}

/** A page's link preview is a postcard too: printed at 1x, with no live numbers that would go stale. */
export async function renderOgImage(site: string, route: RouteId = 'home'): Promise<Blob> {
    const { canvas } = await renderPostcard(cardFor(route), 'wide', site, 1);
    return canvasBlob(canvas);
}
