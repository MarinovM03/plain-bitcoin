// Playwright's WebKit refetches crossorigin font preloads, and preloads lazy tool chunks as plain preload, which it
// flags when a loaded test machine takes over 3 s to use them. Chromium uses modulepreload and never warns.
const WEBKIT_PRELOAD = /(fonts\/.+|assets\/.+\.js) was preloaded using link preload but not used/;

// A forced scene on a test machine without a GPU: the driver reports its own slow read-back. The site never reads pixels.
const SOFTWARE_GL = /GL Driver Message .*GPU stall due to ReadPixels/;

export function realProblems(problems: string[]): string[] {
    return problems.filter((text) => !WEBKIT_PRELOAD.test(text) && !SOFTWARE_GL.test(text));
}
