import { download, today, writeJsonFile } from './lib/data-file.mjs';

const API = 'https://mempool.space/api';
const FILE = 'src/data/blocks-snapshot.json';
const LENGTH = 8;

const height = Number(await download(`${API}/blocks/tip/height`));
const answer = JSON.parse(await download(`${API}/blocks/${height}`));
const blocks = answer.slice(0, LENGTH).map((block) => ({
    height: block.height,
    id: block.id,
    timestamp: block.timestamp,
    tx_count: block.tx_count,
    size: block.size,
    weight: block.weight,
}));
const whole = blocks.every(
    (block, index) =>
        block.height === height - index &&
        /^[0-9a-f]{64}$/.test(block.id) &&
        [block.timestamp, block.tx_count, block.size, block.weight].every((value) => Number.isInteger(value)),
);
if (blocks.length !== LENGTH || !whole) throw new Error(`Unexpected answer for block ${height}`);
await writeJsonFile(FILE, {
    source: 'mempool.space',
    url: `${API}/blocks/${height}`,
    asOf: today(),
    blocks,
});
console.log(`${FILE}: blocks ${height - LENGTH + 1} to ${height}`);
