import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const KB = 1000;

const BUDGETS = {
    initialJs: 35 * KB,
    css: 15 * KB,
    fonts: 80 * KB,
    hero: 260 * KB,
    toolRoute: 15 * KB,
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
const hero = assets.filter((name) => /^hero-.+\.js$/.test(name));
const scenes = hero.filter((name) => /^hero-scene-/.test(name));
const backdrops = assets.filter((name) => /^backdrop-.+\.js$/.test(name));
const pictures = assets.filter((name) => /^picture-.+\.js$/.test(name));
const tools = assets.filter((name) => /^tool-.+\.js$/.test(name));
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
    [
        'Hero: every scene, the renderer and the 3D library together, loaded after first paint (gzip)',
        sum(inAssets(hero)),
        BUDGETS.hero,
    ],
    ...tools.map((name) => [
        `Tool route ${name.replace(/^tool-|-[\w-]{8}\.js$/g, '')} (gzip)`,
        gzipSize(`assets/${name}`),
        BUDGETS.toolRoute,
    ]),
    ['Postcard printer, loaded on first share intent (gzip)', sum(inAssets(postcard)), BUDGETS.postcard],
];

let failed = initial.length === 0 || styles.length === 0 || scenes.length < 6 || postcard.length === 0;
for (const [kind, pattern] of [
    ['world', /hero-/],
    ['postcard printer', /postcard-/],
]) {
    if (!initial.some((path) => pattern.test(path))) continue;
    console.error(`The ${kind} must not load with the page.`);
    failed = true;
}
for (const [label, size, limit] of rows) {
    const ok = size <= limit;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'OVER'} ${label}: ${(size / KB).toFixed(2)} kB of ${limit / KB} kB`);
}
for (const name of [...hero, ...backdrops, ...postcard, ...pictures]) {
    console.log(`     ${name.replace(/-[\w-]{8}\.js$/, '')}: ${(gzipSize(`assets/${name}`) / KB).toFixed(2)} kB`);
}
if (failed) {
    console.error('Bundle budget check failed.');
    process.exit(1);
}
