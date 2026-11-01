import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const KB = 1000;

const BUDGETS = {
    initialJs: 35 * KB,
    css: 15 * KB,
    fonts: 80 * KB,
    stage: 170 * KB,
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
const stage = assets.filter((name) => /^(stage|worker)-.+\.js$/.test(name));
const scenes = assets.filter((name) => /^(scene-|still-).+\.js$/.test(name));

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
    ['Stage, worker, every scene and still (gzip)', sum(inAssets([...stage, ...scenes])), BUDGETS.stage],
];

let failed = initial.length === 0 || styles.length === 0 || stage.length !== 2;
for (const [label, size, limit] of rows) {
    const ok = size <= limit;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'OVER'} ${label}: ${(size / KB).toFixed(2)} kB of ${limit / KB} kB`);
}
for (const name of [...stage, ...scenes]) {
    console.log(`     ${name.replace(/-[\w-]{8}\.js$/, '')}: ${(gzipSize(`assets/${name}`) / KB).toFixed(2)} kB`);
}
if (failed) {
    console.error('Bundle budget check failed.');
    process.exit(1);
}
