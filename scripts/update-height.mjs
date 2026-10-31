import { download, today, writeJsonFile } from './lib/data-file.mjs';

const API = 'https://mempool.space/api';
const FILE = 'src/data/height-anchor.json';

const height = Number(await download(`${API}/blocks/tip/height`));
const [block] = JSON.parse(await download(`${API}/blocks/${height}`));
if (!Number.isInteger(height) || block?.height !== height || !Number.isInteger(block.timestamp)) {
    throw new Error(`Unexpected answer for block ${height}`);
}
await writeJsonFile(FILE, {
    source: 'mempool.space',
    url: `${API}/blocks/tip/height`,
    asOf: today(),
    height,
    time: block.timestamp,
});
console.log(`src/data/height-anchor.json: block ${height} at ${new Date(block.timestamp * 1000).toISOString()}`);
