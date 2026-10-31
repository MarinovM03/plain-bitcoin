export const TOKENS = {
    ink: '#17140f',
    inkRaised: '#201c16',
    line: '#3b342b',
    paper: '#efe6d4',
    muted: '#ab9f8b',
    btc: '#f7931a',
    fiat: '#7db7e8',

    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.25rem, 1.05rem + 0.9vw, 1.5rem)',
    stepHeading: 'clamp(1.875rem, 1.35rem + 2.4vw, 2.75rem)',
    stepFigure: 'clamp(2.5rem, 1.6rem + 4.5vw, 4rem)',

    gutter: '1rem',
    measure: '56rem',
    measureWide: '72rem',
    tap: '2.75rem',
    radius: '6px',
    duration: '160ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;
