/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { TOKENS } from './src/styles/tokens.ts';
import { SITE_DESCRIPTION, SITE_NAME } from './src/ui/copy.ts';
import { renderHome } from './src/ui/home.ts';
import { escapeHtml } from './src/ui/html.ts';
import { renderAnnouncer, renderFooter, renderHeader, renderNoscript } from './src/ui/shell.ts';

const DEFAULT_SITE_URL = 'https://plainbitcoin.org';

const API_ORIGINS = ['https://mempool.space', 'https://blockstream.info'];

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${API_ORIGINS.join(' ')}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
    return {
        name: 'plain-bitcoin:csp',
        apply: 'build',
        transformIndexHtml: () => [
            { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
        ],
    };
}

function shell(siteUrl: string): Plugin {
    const head = [
        `<title>${escapeHtml(SITE_NAME)}</title>`,
        `<meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
        `<link rel="canonical" href="${escapeHtml(siteUrl)}" />`,
        `<meta name="theme-color" content="${TOKENS.ink}" />`,
    ].join('\n');
    const body = [
        renderHeader(),
        `<main id="main">${renderHome()}${renderNoscript()}</main>`,
        renderFooter(),
        renderAnnouncer(),
    ].join('\n');
    return {
        name: 'plain-bitcoin:shell',
        transformIndexHtml: {
            order: 'pre',
            handler: (html) => html.replace('<!--pb:head-->', head).replace('<!--pb:body-->', body),
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/?$/, '/');
    return {
        base: '/',
        define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
        plugins: [contentSecurityPolicy(), shell(siteUrl)],
        worker: { format: 'es' },
        build: {
            target: 'es2022',
            // three.js alone is about 565 kB minified; it loads lazily for the hero and nowhere else.
            chunkSizeWarningLimit: 600,
            rolldownOptions: {
                output: {
                    // three.js changes far less often than the hero, so it caches in its own chunk across releases.
                    codeSplitting: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] },
                },
            },
        },
        preview: { port: 4173, strictPort: true },
        test: { include: ['src/**/*.test.ts'] },
    };
});
