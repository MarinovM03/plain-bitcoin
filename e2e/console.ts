// Playwright's WebKit build refetches crossorigin font preloads and warns; real Safari is on the device checklist.
const WEBKIT_PRELOAD = /fonts\/.+ was preloaded using link preload but not used/;

export function realProblems(problems: string[]): string[] {
    return problems.filter((text) => !WEBKIT_PRELOAD.test(text));
}
