/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { TOKENS } from './src/styles/tokens.ts';
import { SITE_DESCRIPTION, SITE_NAME } from './src/ui/copy.ts';
import { renderHome } from './src/ui/home.ts';
import { escapeHtml } from './src/ui/html.ts';
import { renderAnnouncer, renderFooter, renderHeader, renderNoscript } from './src/ui/shell.ts';

const DEFAULT_SITE_URL = 'https://plainbitcoin.org';

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
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
        build: { target: 'es2022' },
        preview: { port: 4173, strictPort: true },
        test: { include: ['src/**/*.test.ts'] },
    };
});
