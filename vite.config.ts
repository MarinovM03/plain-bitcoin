/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { TOKENS } from './src/styles/tokens.ts';
import { OG_IMAGE, SHARE, SITE_DESCRIPTION, SITE_NAME } from './src/ui/copy.ts';
import { renderHome } from './src/ui/home.ts';
import { escapeHtml } from './src/ui/html.ts';
import { renderAnnouncer, renderFooter, renderHeader, renderNoscript, renderStage } from './src/ui/shell.ts';

const DEFAULT_SITE_URL = 'https://plainbitcoin.org';

const API_ORIGINS = ['https://mempool.space', 'https://blockstream.info', 'https://api.coingecko.com'];

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${API_ORIGINS.join(' ')}`,
    "worker-src 'self'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

const PERMISSIONS_POLICY = [
    'accelerometer=()',
    'autoplay=()',
    'browsing-topics=()',
    'camera=()',
    'clipboard-read=(self)',
    'clipboard-write=(self)',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'hid=()',
    'idle-detection=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'serial=()',
    'usb=()',
    'xr-spatial-tracking=()',
].join(', ');

// frame-ancestors is ignored in a meta tag, so the header carries it.
const HEADERS = `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: ${PERMISSIONS_POLICY}
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`;

function contentSecurityPolicy(): Plugin {
    return {
        name: 'plain-bitcoin:csp',
        apply: 'build',
        transformIndexHtml: () => [
            { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
        ],
    };
}

function cloudflareHeaders(): Plugin {
    return {
        name: 'plain-bitcoin:headers',
        apply: 'build',
        generateBundle() {
            this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
        },
    };
}

function meta(attribute: 'name' | 'property', key: string, value: string): string {
    return `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
}

function shell(siteUrl: string): Plugin {
    const image = `${siteUrl}${OG_IMAGE.path}`;
    const head = [
        `<title>${escapeHtml(SITE_NAME)}</title>`,
        meta('name', 'description', SITE_DESCRIPTION),
        `<link rel="canonical" href="${escapeHtml(siteUrl)}" />`,
        meta('name', 'theme-color', TOKENS.ink),
        meta('property', 'og:type', 'website'),
        meta('property', 'og:site_name', SITE_NAME),
        meta('property', 'og:title', SITE_NAME),
        meta('property', 'og:description', SITE_DESCRIPTION),
        meta('property', 'og:url', siteUrl),
        meta('property', 'og:image', image),
        meta('property', 'og:image:width', String(OG_IMAGE.width)),
        meta('property', 'og:image:height', String(OG_IMAGE.height)),
        meta('property', 'og:image:alt', OG_IMAGE.alt),
        meta('name', 'twitter:card', 'summary_large_image'),
        meta('name', 'twitter:site', SHARE.handle),
        meta('name', 'twitter:title', SITE_NAME),
        meta('name', 'twitter:description', SITE_DESCRIPTION),
        meta('name', 'twitter:image', image),
        meta('name', 'twitter:image:alt', OG_IMAGE.alt),
    ].join('\n');
    const body = [
        renderStage(),
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
        plugins: [contentSecurityPolicy(), cloudflareHeaders(), shell(siteUrl)],
        worker: { format: 'es' },
        build: {
            target: 'es2022',
            rolldownOptions: {
                output: {
                    chunkFileNames: (chunk) =>
                        /[\\/]hero[\\/]scenes[\\/]/.test(chunk.facadeModuleId ?? '')
                            ? 'assets/scene-[name]-[hash].js'
                            : 'assets/[name]-[hash].js',
                },
            },
        },
        preview: { port: 4173, strictPort: true },
        test: { include: ['src/**/*.test.ts'] },
    };
});
