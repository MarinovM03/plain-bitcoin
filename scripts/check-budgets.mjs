import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const KB = 1000;

const BUDGETS = {
    initialJs: 35 * KB,
    css: 15 * KB,
    fonts: 80 * KB,
    stage: 170 * KB,
    scene: 30 * KB,
    homeScene: 35 * KB,
    postcard: 20 * KB,
};

function gzipSize(path) {
    return gzipSync(readFileSync(new URL(path, dist)), { level: 9 }).length;
}

const html = readFileSync(new URL('index.html', dist), 'utf8');
const initial = [
    ...html.matchAll(/<(?:script type="module"[^>]*src|link rel="modulepreload"[^>]*href)="\/([^"]+\.js)"/g),
].map(([, path]) => path);
const styles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"/g)].map(([, path]) => path);
const assets = readdirSync(new URL('assets/', dist));
const fonts = readdirSync(new URL('fonts/', dist)).filter((name) => name.endsWith('.woff2'));
// The stage as it loads by default: the page-side driver, the worker and the worker's shared chunks.
const stage = assets.filter((name) => /^(stage|worker)-.+\.js$/.test(name));
// Without OffscreenCanvas the same engine runs on the page instead; it is reported, never loaded with the worker.
const direct = assets.filter((name) => /^engine-.+\.js$/.test(name));
const scenes = assets.filter((name) => /^scene-(home|left|power|convert|dca|address)-.+\.js$/.test(name));
const readouts = assets.filter((name) => /^readout-.+\.js$/.test(name));
const postcard = assets.filter((name) => /^postcard-.+\.js$/.test(name));

const sum = (paths) => paths.reduce((total, path) => total + gzipSize(path), 0);
const inAssets = (names) => names.map((name) => `assets/${name}`);
const rows = [
    ['Initial JS (gzip)', sum(initial), BUDGETS.initialJs],
    ['CSS (gzip)', sum(styles), BUDGETS.css],
    [
        'Fonts (woff2)',
        fonts.reduce((total, name) => total + statSync(new URL(`fonts/${name}`, dist)).size, 0),
        BUDGETS.fonts,
    ],
    ['Stage: driver, worker, renderer, weather, pointer mapping (gzip)', sum(inAssets(stage)), BUDGETS.stage],
    [
        'Stage without a worker: driver and page-side engine (gzip)',
        sum(inAssets([...stage.filter((n) => n.startsWith('stage-')), ...direct])),
        BUDGETS.stage,
    ],
    ...scenes.map((name) => [
        `Scene ${name.replace(/^scene-(\w+)-.+$/, '$1')}, loaded only on its route (gzip)`,
        gzipSize(`assets/${name}`),
        name.startsWith('scene-home-') ? BUDGETS.homeScene : BUDGETS.scene,
    ]),
    ['Postcard printer, loaded on first share intent (gzip)', sum(inAssets(postcard)), BUDGETS.postcard],
];

let failed =
    initial.length === 0 || styles.length === 0 || stage.length < 2 || scenes.length !== 6 || postcard.length === 0;
if (initial.some((path) => /postcard-/.test(path))) {
    console.error('The postcard printer must not load with the page.');
    failed = true;
}
for (const [label, size, limit] of rows) {
    const ok = size <= limit;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'OVER'} ${label}: ${(size / KB).toFixed(2)} kB of ${limit / KB} kB`);
}
for (const name of [...stage, ...direct, ...postcard, ...readouts]) {
    console.log(`     ${name.replace(/-[\w-]{8}\.js$/, '')}: ${(gzipSize(`assets/${name}`) / KB).toFixed(2)} kB`);
}
if (failed) {
    console.error('Bundle budget check failed.');
    process.exit(1);
}
