import { HEIGHT_ANCHOR } from '../data/height.ts';
import { MAX_SUPPLY, supplyAt } from '../model/supply.ts';
import { OG_IMAGE } from '../ui/copy.ts';
import { canvasBlob, renderPostcard } from './render.ts';

/** The link preview is a postcard too: printed at 1x, from the bundled height anchor, with no live numbers. */
export async function renderOgImage(site: string): Promise<Blob> {
    const { canvas } = await renderPostcard(
        {
            tool: 'home',
            route: '',
            kicker: OG_IMAGE.kicker,
            number: OG_IMAGE.number,
            line: OG_IMAGE.line,
            source: OG_IMAGE.source,
            signature: {
                kind: 'supply',
                issued: supplyAt(HEIGHT_ANCHOR.height).issued,
                max: MAX_SUPPLY,
                undated: true,
            },
            alt: OG_IMAGE.alt,
        },
        'wide',
        site,
        1,
    );
    return canvasBlob(canvas);
}
