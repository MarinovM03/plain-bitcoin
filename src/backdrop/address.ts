import { type BackdropData, frameAspect, type Mark, SHAPE } from './types.ts';

const IDLE_CELLS = 42;
const MAX_CELLS = 90;

/** One square per character: open until the checksum is read, green when it adds up, orange where it cannot. */
export function plan(data: BackdropData | null, aspect: number): Mark[] {
    const typed = data?.id === 'address' && data.length > 0 ? data : null;
    const count = Math.min(MAX_CELLS, typed ? Math.floor(typed.length) : IDLE_CELLS);
    const verdict = typed?.verdict ?? 'none';
    const a = frameAspect(aspect);
    const perRow = a < 1 ? 9 : 18;
    const cell = Math.min((2 * a * 0.9) / perRow, 0.2);
    const rows = Math.ceil(count / perRow);
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / perRow);
        const inRow = row === rows - 1 ? count - row * perRow : perRow;
        const wrong = verdict === 'bad' && typed?.suspect === index;
        return {
            x: ((index % perRow) - (inRow - 1) / 2) * cell,
            y: ((rows - 1) / 2 - row) * cell,
            w: cell * 0.78,
            h: cell * 0.78,
            tone: wrong ? 'btc' : verdict === 'good' ? 'good' : verdict === 'bad' ? 'warm' : 'cool',
            level: wrong ? 1 : verdict === 'good' ? 0.85 : 0.55,
            shape: wrong || verdict === 'good' ? SHAPE.square : SHAPE.squareOpen,
        };
    });
}
