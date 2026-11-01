import { HEIGHT_ANCHOR } from '../data/height.ts';
import { sceneArt } from '../hero/bus.ts';
import { OG_IMAGE } from '../ui/copy.ts';
import { renderCard } from './card.ts';

const ART_ASPECT = 1.4;

export async function renderOgImage(site: string): Promise<Blob> {
    const card = {
        headline: OG_IMAGE.headline,
        detail: OG_IMAGE.detail,
        source: OG_IMAGE.source,
        alt: OG_IMAGE.alt,
        copy: OG_IMAGE.headline,
        fileName: OG_IMAGE.path,
    };
    const art = await sceneArt({ id: 'left', height: HEIGHT_ANCHOR.height }, ART_ASPECT);
    return renderCard(card, 'og', site, art);
}
