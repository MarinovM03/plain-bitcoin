import { HEIGHT_ANCHOR } from '../data/height.ts';
import { drawFlatField } from '../hero/flat.ts';
import { tokenState } from '../hero/layout.ts';
import { supplyAt } from '../model/supply.ts';
import { OG_IMAGE } from '../ui/copy.ts';
import { renderCard } from './card.ts';

export function renderOgImage(site: string): Promise<Blob> {
    const tokens = tokenState(supplyAt(HEIGHT_ANCHOR.height).issued);
    const card = {
        headline: OG_IMAGE.headline,
        detail: OG_IMAGE.detail,
        source: OG_IMAGE.source,
        alt: OG_IMAGE.alt,
        copy: OG_IMAGE.headline,
        fileName: OG_IMAGE.path,
    };
    return renderCard(card, 'og', site, (context, box) => drawFlatField(context, box, tokens));
}
