import { GRID_DOTS, satsScale } from '../../util/sats-scale.ts';
import { emptyLayout, fitGrid, inkIndex, type Layout, plotBox, type SceneData } from './types.ts';

export function convertLayout(data: SceneData, aspect: number): Layout {
    const scale = satsScale(data.id === 'convert' ? data.sats : 0);
    const box = plotBox(aspect);
    const { cols, cell } = fitGrid(GRID_DOTS, box);
    const rows = Math.ceil(GRID_DOTS / cols);
    const left = box.x + (box.w - cols * cell) / 2;
    const top = box.y + (box.h - rows * cell) / 2;
    const layout = emptyLayout(GRID_DOTS, `convert:${cols}:${scale.perDot}`);
    for (let i = 0; i < GRID_DOTS; i += 1) {
        layout.x[i] = left + ((i % cols) + 0.5) * cell;
        layout.y[i] = top + (Math.floor(i / cols) + 0.5) * cell;
        if (i < scale.filled) {
            layout.ink[i] = inkIndex('btc');
            layout.r[i] = cell * 0.36;
        } else if (i === scale.filled && scale.partial > 0) {
            layout.ink[i] = inkIndex('ember');
            layout.r[i] = cell * (0.12 + 0.24 * scale.partial);
        } else {
            layout.ink[i] = inkIndex('faint');
            layout.r[i] = cell * 0.16;
        }
    }
    return layout;
}
