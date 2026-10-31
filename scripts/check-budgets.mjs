import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const KB = 1000;

const BUDGETS = {
    initialJs: 35 * KB,
    css: 15 * KB,
    fonts: 80 * KB,
    hero: 170 * KB,
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
const worker = assets.filter((name) => /^worker-.+\.js$/.test(name));
const mainThreadHero = assets.filter((name) => /^(three|scene|post)-.+\.js$/.test(name));

const sum = (paths) => paths.reduce((total, path) => total + gzipSize(path), 0);
const rows = [
    ['Initial JS (gzip)', sum(initial), BUDGETS.initialJs],
    ['CSS (gzip)', sum(styles), BUDGETS.css],
    [
        'Fonts (woff2)',
        fonts.reduce((total, name) => total + statSync(new URL(`fonts/${name}`, dist)).size, 0),
        BUDGETS.fonts,
    ],
    ['Hero worker (gzip)', sum(worker.map((name) => `assets/${name}`)), BUDGETS.hero],
    ['Hero main-thread fallback (gzip)', sum(mainThreadHero.map((name) => `assets/${name}`)), BUDGETS.hero],
];

let failed = initial.length === 0 || styles.length === 0 || worker.length === 0;
for (const [label, size, limit] of rows) {
    const ok = size <= limit;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'OVER'} ${label}: ${(size / KB).toFixed(2)} kB of ${limit / KB} kB`);
}
if (failed) {
    console.error('Bundle budget check failed.');
    process.exit(1);
}
